import { Observable, Subject, Subscription } from 'rxjs';
import { ColliderDesc, RigidBodyDesc } from '@dimforge/rapier2d-compat';
import { Rapier2dRigidBodyComponent } from './rapier-2d-rigid-body.component';
import { DebugBody2DSettings, ITrigger2dComponent, Shape2DDescriptor } from '@gg-web-engine/core';
import { Rapier2dWorldComponent } from './rapier-2d-world.component';
import { Rapier2dCharacterControllerComponent } from './rapier-2d-character-controller.component';
import { Rapier2dGgWorld, Rapier2dPhysicsTypeDocRepo } from '../types';

// a rigid body or a character controller can overlap this trigger's sensor volume
type Rapier2dOverlapping = Rapier2dRigidBodyComponent | Rapier2dCharacterControllerComponent;

export class Rapier2dTriggerComponent
  extends Rapier2dRigidBodyComponent
  implements ITrigger2dComponent<Rapier2dPhysicsTypeDocRepo>
{
  readonly debugBodySettings: DebugBody2DSettings = new DebugBody2DSettings(
    { type: 'TRIGGER', activated: () => this.overlaps.size > 0 },
    this.shape,
  );

  get onEntityEntered(): Observable<Rapier2dOverlapping> {
    return this.onEnter$.asObservable();
  }

  get onEntityLeft(): Observable<Rapier2dOverlapping> {
    return this.onLeft$.asObservable();
  }

  /**
   * Overlapping bodies, each with its number of currently intersecting collider pairs. Rapier
   * reports sensor intersections per collider, and a `COMPOUND` trigger (or a `COMPOUND` body) is one
   * collider per part, so a body crossing from one part of an L-shaped trigger into the other gets
   * a native start for the second part before the stop for the first. `onEntityEntered` fires only
   * when a body's count goes from 0 to 1 and `onEntityLeft` only when it returns to 0.
   */
  protected readonly overlaps: Map<Rapier2dOverlapping, number> = new Map();
  /**
   * Bodies removed from the world while overlapping this trigger, whose `onEntityLeft` is still to
   * be emitted. The intersection stop Rapier reports for a removed collider can't be routed (its
   * handle no longer resolves to it - see the world's event dispatch), so the world's `removed$`
   * drops the body's entry from `overlaps` the moment it leaves the world - otherwise a body removed
   * and added back before the next step (reparented, or hidden and shown again by a network layer)
   * would keep its old count, and its fresh colliders' start would only raise it, leaving the count
   * one above the stops still to come. The leave itself is emitted at this trigger's next
   * controlled point (`checkOverlaps()`, or before the next overlap notification, so a re-added body
   * reports leave before its new enter), never synchronously from inside the remover's own
   * `removeFromWorld` call.
   */
  protected readonly pendingLeft: Set<Rapier2dOverlapping> = new Set();
  protected readonly onEnter$: Subject<Rapier2dOverlapping> = new Subject<Rapier2dOverlapping>();
  protected readonly onLeft$: Subject<Rapier2dOverlapping> = new Subject<Rapier2dOverlapping>();
  private removedSub: Subscription | null = null;

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
      throw new Error(
        "Rapier2D bodies cannot be shared between different worlds: this one was created by another world's factory. " +
          'Create it with the factory of the world it is added to (`world.physicsWorld.factory`).',
      );
    }
    this.overlaps.clear();
    this.pendingLeft.clear();
    this.removedSub?.unsubscribe();
    this.removedSub = this.world.removed$.subscribe(c => {
      if (this.overlaps.delete(c)) {
        this.pendingLeft.add(c);
      }
    });
    this._nativeBody = this.world.nativeWorld!.createRigidBody(this._bodyDescr);
    this._nativeBodyColliders = this._colliderDescr.map(c =>
      this.world.nativeWorld!.createCollider(c, this._nativeBody!),
    );
    this.world.handleIdEntityMap.set(this._nativeBody!.handle, this);
    this.world.added$.next(this);
  }

  removeFromWorld(world: Rapier2dGgWorld, dispose?: boolean) {
    this.removedSub?.unsubscribe();
    this.removedSub = null;
    this.flushPendingLeft();
    for (const body of this.overlaps.keys()) {
      this.onLeft$.next(body);
    }
    this.overlaps.clear();
    super.removeFromWorld(world, dispose);
  }

  /** @internal invoked by `Rapier2dWorldComponent.simulate()` for each sensor-intersection
   * start/stop drained from the world's shared event queue that involves one of this trigger's
   * colliders. The world drains that queue once per step and routes every event itself (so plain
   * rigid-body contacts reach `Rapier2dRigidBodyComponent.handleCollisionStart`/`handleCollisionEnd`
   * from the same drain - see `Rapier2dWorldComponent.simulate`'s own doc); `other` is the
   * component owning the other collider's body. */
  handleOverlapEvent(other: Rapier2dOverlapping, started: boolean): void {
    this.flushPendingLeft();
    const count = this.overlaps.get(other) ?? 0;
    if (started) {
      this.overlaps.set(other, count + 1);
      if (count === 0) {
        this.onEnter$.next(other);
      }
    } else if (count > 0) {
      if (count === 1) {
        this.overlaps.delete(other);
        this.onLeft$.next(other);
      } else {
        this.overlaps.set(other, count - 1);
      }
    }
  }

  /** Emits `onEntityLeft` for bodies removed from the world while overlapping - see `pendingLeft`. */
  checkOverlaps(): void {
    this.flushPendingLeft();
  }

  private flushPendingLeft(): void {
    for (const body of this.pendingLeft) {
      this.pendingLeft.delete(body);
      this.onLeft$.next(body);
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
    this.removedSub?.unsubscribe();
    this.removedSub = null;
    this.overlaps.clear();
    this.pendingLeft.clear();
    this.onEnter$.complete();
    this.onLeft$.complete();
    super.dispose();
  }
}
