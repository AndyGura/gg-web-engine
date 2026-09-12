import { Observable, Subject } from 'rxjs';
import { ColliderDesc, RigidBodyDesc } from '@dimforge/rapier3d-compat';
import { Rapier3dRigidBodyComponent } from './rapier-3d-rigid-body.component';
import { DebugBody3DSettings, ITrigger3dComponent, Shape3DDescriptor } from '@gg-web-engine/core';
import { Rapier3dWorldComponent } from './rapier-3d-world.component';
import { Rapier3dGgWorld, Rapier3dPhysicsTypeDocRepo } from '../types';

export class Rapier3dTriggerComponent
  extends Rapier3dRigidBodyComponent
  implements ITrigger3dComponent<Rapier3dPhysicsTypeDocRepo>
{
  readonly debugBodySettings: DebugBody3DSettings = new DebugBody3DSettings(
    { type: 'TRIGGER', activated: () => this.overlaps.size > 0 },
    this.shape,
  );

  get onEntityEntered(): Observable<Rapier3dRigidBodyComponent> {
    return this.onEnter$.asObservable();
  }

  get onEntityLeft(): Observable<Rapier3dRigidBodyComponent> {
    return this.onLeft$.asObservable();
  }

  protected readonly overlaps: Set<Rapier3dRigidBodyComponent> = new Set<Rapier3dRigidBodyComponent>();
  protected readonly onEnter$: Subject<Rapier3dRigidBodyComponent> = new Subject<Rapier3dRigidBodyComponent>();
  protected readonly onLeft$: Subject<Rapier3dRigidBodyComponent> = new Subject<Rapier3dRigidBodyComponent>();

  constructor(
    protected readonly world: Rapier3dWorldComponent,
    protected _colliderDescr: ColliderDesc[],
    public readonly shape: Shape3DDescriptor,
    protected _bodyDescr: RigidBodyDesc,
  ) {
    super(world, _colliderDescr, shape, _bodyDescr, null!);
  }

  addToWorld(world: Rapier3dGgWorld): void {
    if (world.physicsWorld != this.world) {
      throw new Error('Rapier3D bodies cannot be shared between different worlds');
    }
    this.overlaps.clear();
    this._nativeBody = this.world.nativeWorld!.createRigidBody(this._bodyDescr);
    this._nativeBodyColliders = this._colliderDescr.map(c =>
      this.world.nativeWorld!.createCollider(c, this._nativeBody!),
    );
    this.world.handleIdEntityMap.set(this._nativeBody!.handle, this);
    this.world.added$.next(this);
  }

  removeFromWorld(world: Rapier3dGgWorld, dispose?: boolean) {
    for (const body of this.overlaps) {
      this.onLeft$.next(body);
    }
    this.overlaps.clear();
    super.removeFromWorld(world, dispose);
  }

  /**
   * Called by `Rapier3dWorldComponent`'s centralized collision-event dispatch (see
   * `Rapier3dWorldComponent.simulate`) once per drained sensor-intersection event involving this
   * trigger - not meant to be called by app code directly. Previously this trigger drained
   * `world.eventQueue` itself from inside `checkOverlaps()`, matching `otherBody` by comparing an
   * event's *collider* handle against `this.nativeBody?.handle` (a *rigid-body* handle) - those are
   * two different handle namespaces in this pinned `@dimforge/rapier3d-compat` build, and the
   * comparison only ever happened to work by coincidence (a body's first/only collider is allocated
   * from a separate arena that, absent any prior removals, marches in lockstep with the rigid-body
   * arena for the common one-collider-per-body case - see `gg-engine-physics-adapter-rapier` for the
   * full incident). `EventQueue.drainCollisionEvents` also fully drains the *shared* queue on every
   * call, so more than one consumer draining it independently (this trigger, another trigger, and now
   * `Rapier3dRigidBodyComponent`'s own collision events) would silently steal each other's events -
   * `Rapier3dWorldComponent` is now the single place that drains it, resolving collider handles to
   * components correctly via `Collider.parent()`, and pushes matching events to whichever
   * component(s) care.
   */
  public notifyOverlap(otherBody: Rapier3dRigidBodyComponent, started: boolean): void {
    if (started) {
      this.overlaps.add(otherBody);
      this.onEnter$.next(otherBody);
    } else {
      this.overlaps.delete(otherBody);
      this.onLeft$.next(otherBody);
    }
  }

  checkOverlaps(): void {
    // Rapier does not reliably emit a native intersection-stop event for a collider that's simply
    // removed from the world mid-overlap (confirmed empirically) - this manual pass catches that case
    // every tick regardless of whether `Rapier3dWorldComponent.simulate`'s own event dispatch already
    // ran this tick.
    for (const body of this.overlaps.keys()) {
      if (!body.nativeBody) {
        this.overlaps.delete(body);
        this.onLeft$.next(body);
      }
    }
  }

  clone(): Rapier3dTriggerComponent {
    const [colliderDescr, sd, bd] = super.factoryProps;
    let component = new Rapier3dTriggerComponent(this.world, colliderDescr, sd, bd);
    component.ownCollisionGroups = this.ownCollisionGroups;
    component.interactWithCollisionGroups = this.interactWithCollisionGroups;
    return component;
  }

  dispose() {
    this.overlaps.clear();
    super.dispose();
  }
}
