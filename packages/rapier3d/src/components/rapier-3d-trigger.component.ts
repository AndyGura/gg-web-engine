import { Observable, Subject, Subscription } from 'rxjs';
import { ColliderDesc, RigidBodyDesc } from '@dimforge/rapier3d-compat';
import { Rapier3dRigidBodyComponent } from './rapier-3d-rigid-body.component';
import { DebugBody3DSettings, ITrigger3dComponent, Shape3DDescriptor } from '@gg-web-engine/core';
import { Rapier3dWorldComponent } from './rapier-3d-world.component';
import { Rapier3dCharacterControllerComponent } from './rapier-3d-character-controller.component';
import { Rapier3dGgWorld, Rapier3dPhysicsTypeDocRepo } from '../types';

// a rigid body or a character controller can overlap this trigger's sensor volume
type Rapier3dOverlapping = Rapier3dRigidBodyComponent | Rapier3dCharacterControllerComponent;

export class Rapier3dTriggerComponent
  extends Rapier3dRigidBodyComponent
  implements ITrigger3dComponent<Rapier3dPhysicsTypeDocRepo>
{
  readonly debugBodySettings: DebugBody3DSettings = new DebugBody3DSettings(
    { type: 'TRIGGER', activated: () => this.overlaps.size > 0 },
    this.shape,
  );

  get onEntityEntered(): Observable<Rapier3dOverlapping> {
    return this.onEnter$.asObservable();
  }

  get onEntityLeft(): Observable<Rapier3dOverlapping> {
    return this.onLeft$.asObservable();
  }

  /**
   * Overlapping bodies, each with its number of currently intersecting collider pairs. Rapier
   * reports sensor intersections per collider, and a `COMPOUND` trigger (or a `COMPOUND` body) is one
   * collider per part, so a body crossing from one part of an L-shaped trigger into the other gets
   * a native start for the second part before the stop for the first. `onEntityEntered` fires only
   * when a body's count goes from 0 to 1 and `onEntityLeft` only when it returns to 0.
   */
  protected readonly overlaps: Map<Rapier3dOverlapping, number> = new Map();
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
  protected readonly pendingLeft: Set<Rapier3dOverlapping> = new Set();
  protected readonly onEnter$: Subject<Rapier3dOverlapping> = new Subject();
  protected readonly onLeft$: Subject<Rapier3dOverlapping> = new Subject();
  private removedSub: Subscription | null = null;

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
      throw new Error(
        "Rapier3D bodies cannot be shared between different worlds: this one was created by another world's factory. " +
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

  removeFromWorld(world: Rapier3dGgWorld, dispose?: boolean) {
    this.removedSub?.unsubscribe();
    this.removedSub = null;
    this.flushPendingLeft();
    for (const body of this.overlaps.keys()) {
      this.onLeft$.next(body);
    }
    this.overlaps.clear();
    super.removeFromWorld(world, dispose);
  }

  /**
   * Called by `Rapier3dWorldComponent`'s collision-event dispatch (see
   * `Rapier3dWorldComponent.simulate`) once per drained sensor-intersection start/stop involving
   * one of this trigger's colliders - not meant to be called by app code directly. The world is the
   * only consumer of its single shared `EventQueue` (`drainCollisionEvents` empties it for everyone),
   * and it resolves each collider handle to its owning component through `Collider.parent()`, so
   * `otherBody` is the component of whichever body the other collider belongs to.
   *
   * `otherBody` can be a `Rapier3dCharacterControllerComponent` (a player walking through this
   * trigger) as well as an ordinary rigid body - `onEnter$`/`onLeft$` (and `ITrigger3dComponent`'s
   * own `onEntityEntered`/`onEntityLeft`) are typed as this same union rather than narrowed to a
   * rigid body, since a character controller only satisfies `IBodyComponent`, not
   * `IRigidBodyComponent`.
   */
  public notifyOverlap(otherBody: Rapier3dOverlapping, started: boolean): void {
    this.flushPendingLeft();
    const count = this.overlaps.get(otherBody) ?? 0;
    if (started) {
      this.overlaps.set(otherBody, count + 1);
      if (count === 0) {
        this.onEnter$.next(otherBody);
      }
    } else if (count > 0) {
      if (count === 1) {
        this.overlaps.delete(otherBody);
        this.onLeft$.next(otherBody);
      } else {
        this.overlaps.set(otherBody, count - 1);
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

  clone(): Rapier3dTriggerComponent {
    const [colliderDescr, sd, bd] = super.factoryProps;
    let component = new Rapier3dTriggerComponent(this.world, colliderDescr, sd, bd);
    component.ownCollisionGroups = this.ownCollisionGroups;
    component.interactWithCollisionGroups = this.interactWithCollisionGroups;
    return component;
  }

  /** Completes `onEnter$`/`onLeft$` on top of `Rapier3dRigidBodyComponent.dispose()`'s own
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
