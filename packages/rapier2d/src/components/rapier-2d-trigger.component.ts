import { Observable, Subject } from 'rxjs';
import { ColliderDesc, RigidBodyDesc } from '@dimforge/rapier2d-compat';
import { Rapier2dRigidBodyComponent } from './rapier-2d-rigid-body.component';
import { DebugBody2DSettings, ITrigger2dComponent, Shape2DDescriptor } from '@gg-web-engine/core';
import { Rapier2dWorldComponent } from './rapier-2d-world.component';
import { Rapier2dGgWorld, Rapier2dPhysicsTypeDocRepo } from '../types';

export class Rapier2dTriggerComponent
  extends Rapier2dRigidBodyComponent
  implements ITrigger2dComponent<Rapier2dPhysicsTypeDocRepo>
{
  readonly debugBodySettings: DebugBody2DSettings = new DebugBody2DSettings(
    { type: 'TRIGGER', activated: () => this.overlaps.size > 0 },
    this.shape,
  );

  get onEntityEntered(): Observable<Rapier2dRigidBodyComponent> {
    return this.onEnter$.asObservable();
  }

  get onEntityLeft(): Observable<Rapier2dRigidBodyComponent> {
    return this.onLeft$.asObservable();
  }

  protected readonly overlaps: Set<Rapier2dRigidBodyComponent> = new Set<Rapier2dRigidBodyComponent>();
  protected readonly onEnter$: Subject<Rapier2dRigidBodyComponent> = new Subject<Rapier2dRigidBodyComponent>();
  protected readonly onLeft$: Subject<Rapier2dRigidBodyComponent> = new Subject<Rapier2dRigidBodyComponent>();

  constructor(
    protected readonly world: Rapier2dWorldComponent,
    protected _colliderDescr: ColliderDesc[],
    public readonly shape: Shape2DDescriptor,
    protected _bodyDescr: RigidBodyDesc,
  ) {
    super(world, _colliderDescr, shape, _bodyDescr, null!);
  }

  addToWorld(world: Rapier2dGgWorld): void {
    if (world.physicsWorld != this.world) {
      throw new Error('Rapier2D bodies cannot be shared between different worlds');
    }
    this.overlaps.clear();
    this._nativeBody = this.world.nativeWorld!.createRigidBody(this._bodyDescr);
    this._nativeBodyColliders = this._colliderDescr.map(c =>
      this.world.nativeWorld!.createCollider(c, this._nativeBody!),
    );
    this.world.handleIdEntityMap.set(this._nativeBody!.handle, this);
    this.world.added$.next(this);
  }

  removeFromWorld(world: Rapier2dGgWorld, dispose?: boolean) {
    for (const body of this.overlaps) {
      this.onLeft$.next(body);
    }
    this.overlaps.clear();
    super.removeFromWorld(world, dispose);
  }

  /** @internal invoked by `Rapier2dWorldComponent.simulate()` for each sensor-overlap start/stop
   * transition drained from the world's shared event queue that involves this trigger - draining
   * now happens once, centrally, in the world component (so it can also route plain rigid-body
   * contact events to `Rapier2dRigidBodyComponent.handleCollisionStart`/`handleCollisionEnd`
   * without racing this trigger for the same queue - see `Rapier2dWorldComponent.simulate`'s own
   * doc), rather than each trigger draining the whole queue itself on every `checkOverlaps()` call
   * as before. */
  handleOverlapEvent(other: Rapier2dRigidBodyComponent, started: boolean): void {
    if (started) {
      this.overlaps.add(other);
      this.onEnter$.next(other);
    } else {
      this.overlaps.delete(other);
      this.onLeft$.next(other);
    }
  }

  checkOverlaps(): void {
    for (const body of this.overlaps) {
      if (!body.nativeBody) {
        this.overlaps.delete(body);
        this.onLeft$.next(body);
      }
    }
  }

  clone(): Rapier2dTriggerComponent {
    const [colliderDescr, sd, bd] = super.factoryProps;
    const component = new Rapier2dTriggerComponent(this.world, colliderDescr, sd, bd);
    component.ownCollisionGroups = this.ownCollisionGroups;
    component.interactWithCollisionGroups = this.interactWithCollisionGroups;
    return component;
  }

  /** Completes `onEnter$`/`onLeft$` on top of `Rapier2dRigidBodyComponent.dispose()`'s own
   * `onCollisionStart$`/`onCollisionEnd$` completion (via `super.dispose()`) - this trigger's own
   * subjects have no other owner to complete them. */
  dispose() {
    this.overlaps.clear();
    this.onEnter$.complete();
    this.onLeft$.complete();
    super.dispose();
  }
}
