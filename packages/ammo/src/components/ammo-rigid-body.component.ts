import { AmmoWorldComponent } from './ammo-world.component';
import Ammo from '../ammo.js/ammo';
import { AmmoBodyComponent } from './ammo-body.component';
import {
  BodyOptions,
  BodyType,
  CollisionEvent,
  DebugBody3DSettings,
  Entity3d,
  IRigidBody3dComponent,
  Point3,
  Point4,
  Shape3DDescriptor,
} from '@gg-web-engine/core';
import { Observable, Subject } from 'rxjs';
import { AmmoGgWorld, AmmoPhysicsTypeDocRepo } from '../types';

export class AmmoRigidBodyComponent
  extends AmmoBodyComponent<Ammo.btRigidBody>
  implements IRigidBody3dComponent<AmmoPhysicsTypeDocRepo>
{
  public entity: Entity3d | null = null;

  get linearVelocity(): Point3 {
    const v = this.nativeBody.getLinearVelocity();
    return { x: v.x(), y: v.y(), z: v.z() };
  }

  set linearVelocity(value: Point3) {
    this.nativeBody.setLinearVelocity(AmmoBodyComponent.scratchVector(value.x, value.y, value.z));
    this.nativeBody.activate(true);
  }

  /**
   * Bullet keeps a rigid body's pose in three places, and a teleport (the `position`/`rotation`
   * setters, `resetMotion()`) has to write every one this body type reads, or a later step reads a
   * stale one:
   * - `kinematic_pos`/`kinematic_vel`: Bullet's own kinematic bookkeeping
   *   (`btRigidBody::saveKinematicState`, run every `stepSimulation` for every
   *   `CF_KINEMATIC_OBJECT` body) *pulls* the body's transform from its motion state, overwriting
   *   `m_worldTransform`, and derives the body's velocity for that step from the move (the velocity
   *   that lets it push/wake the dynamic bodies it sweeps into). Writing only `setWorldTransform`
   *   gets reverted by the next step - a real, reproduced regression: a moving kinematic floor's
   *   position writes looked fought/ignored. So the motion state is written too.
   * - `dynamic`: `setCenterOfMassTransform`, which besides `m_worldTransform` sets the
   *   interpolation transform and velocities and the world-space inertia tensor (a rotation
   *   teleport with `setWorldTransform` alone leaves the inertia tensor oriented for the old
   *   rotation until the next step). The motion state is written too:
   *   `btRaycastVehicle.updateWheelTransform(i, true)` (`AmmoRaycastVehicleComponent
   *   .resetSuspension()`) places the wheels from the chassis's motion state.
   * - `static`: the plain `setWorldTransform` of `AmmoBodyComponent` - Bullet never reads anything
   *   else of a static body.
   */
  protected applyWorldTransform(transform: Ammo.btTransform): void {
    if (this.bodyType === 'kinematic_pos' || this.bodyType === 'kinematic_vel') {
      this.nativeBody.getMotionState().setWorldTransform(transform);
      this.nativeBody.setWorldTransform(transform);
      this.nativeBody.activate(true);
    } else if (this.bodyType === 'dynamic') {
      this.nativeBody.setCenterOfMassTransform(transform);
      this.nativeBody.getMotionState().setWorldTransform(transform);
      this.nativeBody.activate(true);
    } else {
      super.applyWorldTransform(transform);
    }
  }

  /**
   * Bullet accumulates applied forces/torques in the body (`m_totalForce`/`m_totalTorque`), uses
   * them in every internal substep of the next `stepSimulation` and clears them at its end - exactly
   * `IRigidBodyComponent.applyForce`'s "the next `simulate()` call, then gone" lifetime, so no
   * bookkeeping is needed here. A force at a point is `applyForce(force, rel_pos)`, `rel_pos` being
   * the point relative to the centre of mass in world orientation.
   */
  applyForce(force: Point3, worldPoint?: Point3): void {
    if (this.bodyType !== 'dynamic') {
      return;
    }
    const f = new Ammo.btVector3(force.x, force.y, force.z);
    const rel = this.relativeToCenterOfMass(worldPoint);
    this.nativeBody.applyForce(f, rel);
    Ammo.destroy(f);
    Ammo.destroy(rel);
    this.nativeBody.activate(true);
  }

  applyImpulse(impulse: Point3, worldPoint?: Point3): void {
    if (this.bodyType !== 'dynamic') {
      return;
    }
    const j = new Ammo.btVector3(impulse.x, impulse.y, impulse.z);
    const rel = this.relativeToCenterOfMass(worldPoint);
    this.nativeBody.applyImpulse(j, rel);
    Ammo.destroy(j);
    Ammo.destroy(rel);
    this.nativeBody.activate(true);
  }

  applyTorque(torque: Point3): void {
    if (this.bodyType !== 'dynamic') {
      return;
    }
    this.nativeBody.applyTorque(AmmoBodyComponent.scratchVector(torque.x, torque.y, torque.z));
    this.nativeBody.activate(true);
  }

  applyTorqueImpulse(torqueImpulse: Point3): void {
    if (this.bodyType !== 'dynamic') {
      return;
    }
    this.nativeBody.applyTorqueImpulse(
      AmmoBodyComponent.scratchVector(torqueImpulse.x, torqueImpulse.y, torqueImpulse.z),
    );
    this.nativeBody.activate(true);
  }

  /** A fresh `btVector3` (caller destroys it) of `worldPoint` relative to the centre of mass, or zero without one. */
  private relativeToCenterOfMass(worldPoint?: Point3): Ammo.btVector3 {
    if (!worldPoint) {
      return new Ammo.btVector3(0, 0, 0);
    }
    const com = this.nativeBody.getCenterOfMassPosition();
    return new Ammo.btVector3(worldPoint.x - com.x(), worldPoint.y - com.y(), worldPoint.z - com.z());
  }

  get angularVelocity(): Point3 {
    const v = this.nativeBody.getAngularVelocity();
    return { x: v.x(), y: v.y(), z: v.z() };
  }

  set angularVelocity(value: Point3) {
    this.nativeBody.setAngularVelocity(AmmoBodyComponent.scratchVector(value.x, value.y, value.z));
    this.nativeBody.activate(true);
  }

  readonly debugBodySettings: DebugBody3DSettings = new DebugBody3DSettings(
    this._nativeBody.isStaticObject()
      ? { type: 'RIGID_STATIC' }
      : this._nativeBody.isKinematicObject()
        ? { type: 'RIGID_KINEMATIC' }
        : { type: 'RIGID_DYNAMIC', sleeping: () => this.isSleeping },
    this.shape,
  );

  get bodyOptions(): Readonly<BodyOptions> {
    return {
      bodyType: this.bodyType,
      mass: this.nativeBody.getMass(),
      friction: this.nativeBody.getFriction(),
      restitution: this.nativeBody.getRestitution(),
      ccd: this.ccd,
      canSleep: this.canSleep,
      ownCollisionGroups: this.ownCollisionGroups,
      interactWithCollisionGroups: this.interactWithCollisionGroups,
    };
  }

  /**
   * Back `onCollisionStart`/`onCollisionEnd` below. Populated exclusively by
   * `AmmoWorldComponent.simulate()`'s own post-`stepSimulation` manifold bookkeeping via
   * `emitCollisionStart`/`emitCollisionEnd` - a single body has no way to discover the *other*
   * side of a contact pair (or when it stops touching something) on its own, so the world
   * component (which walks `dispatcher.getNumManifolds()` once per tick) is the only writer.
   * Kept protected rather than exposing the Subjects directly, mirroring how
   * `AmmoTriggerComponent` keeps its own `onEnter$`/`onLeft$` reachable only through its own
   * bookkeeping method (`checkOverlaps`).
   */
  protected readonly onCollisionStart$: Subject<CollisionEvent<Point3, AmmoRigidBodyComponent>> = new Subject<
    CollisionEvent<Point3, AmmoRigidBodyComponent>
  >();
  protected readonly onCollisionEnd$: Subject<AmmoRigidBodyComponent | null> =
    new Subject<AmmoRigidBodyComponent | null>();

  get onCollisionStart(): Observable<CollisionEvent<Point3, AmmoRigidBodyComponent>> {
    return this.onCollisionStart$;
  }

  get onCollisionEnd(): Observable<AmmoRigidBodyComponent | null> {
    return this.onCollisionEnd$;
  }

  /** Called by `AmmoWorldComponent.simulate()` only - see `onCollisionStart$`'s own doc. */
  emitCollisionStart(event: CollisionEvent<Point3, AmmoRigidBodyComponent>): void {
    this.onCollisionStart$.next(event);
  }

  /** Called by `AmmoWorldComponent.simulate()` only - see `onCollisionStart$`'s own doc. */
  emitCollisionEnd(other: AmmoRigidBodyComponent | null): void {
    this.onCollisionEnd$.next(other);
  }

  constructor(
    protected readonly world: AmmoWorldComponent,
    protected _nativeBody: Ammo.btRigidBody,
    public readonly shape: Shape3DDescriptor,
    public readonly bodyType: BodyType = 'dynamic',
    public readonly ccd: boolean = false,
    public readonly canSleep: boolean = true,
  ) {
    super(world, _nativeBody, shape);
  }

  clone(): AmmoRigidBodyComponent {
    return this.world.factory.createRigidBodyFromShape(
      this._nativeBody.getCollisionShape(),
      this.shape,
      {
        bodyType: this.bodyType,
        mass: this._nativeBody.getMass(),
        friction: this._nativeBody.getFriction(),
        restitution: this._nativeBody.getRestitution(),
        ccd: this.ccd,
        canSleep: this.canSleep,
      },
      {
        position: this.position,
        rotation: this.rotation,
      },
    );
  }

  addToWorld(world: AmmoGgWorld): void {
    this.world.dynamicAmmoWorld?.addRigidBody(this.nativeBody, this._ownCGsMask, this._interactWithCGsMask);
    if (this.bodyType === 'kinematic_vel') {
      this.world.registerKinematicVelBody(this);
    }
    super.addToWorld(world);
  }

  removeFromWorld(world: AmmoGgWorld, dispose?: boolean): void {
    this.world.dynamicAmmoWorld?.removeRigidBody(this.nativeBody);
    if (this.bodyType === 'kinematic_vel') {
      this.world.unregisterKinematicVelBody(this);
    }
    super.removeFromWorld(world, dispose);
  }

  refreshCG(): void {
    this.world.dynamicAmmoWorld?.removeRigidBody(this.nativeBody);
    this.world.dynamicAmmoWorld?.addRigidBody(this.nativeBody, this._ownCGsMask, this._interactWithCGsMask);
  }

  /**
   * Temporarily detaches this body from the world's broadphase - deliberately **not** the same as
   * `removeFromWorld`/`addToWorld` (no `world.removed$`/`added$` notification is emitted, and
   * `addedToWorld` stays `true` throughout): for a caller doing a short, synchronous,
   * self-contained collision query that needs this specific body genuinely invisible to detection,
   * not just non-colliding, without those bookkeeping side effects. Restore with
   * `reattachToBroadphase()` before returning control to anything else. See
   * `AmmoCharacterControllerComponent.ignoredBodies` for the concrete use (a currently-held
   * `Grabbable3dEntity` excluded from its holder's own sweeps/overlap recovery - see
   * `ICharacterController3dComponent.ignoredBodies`'s doc for why collision groups can't do this).
   *
   * Returns whether this body was actually detached (`false`, a no-op, if it wasn't in this world's
   * broadphase to begin with) - callers should only call `reattachToBroadphase()` for a body this
   * returned `true` for, mirroring `removeCollisionObject`/`addCollisionObject`'s own pairing.
   */
  detachFromBroadphaseTemporarily(): boolean {
    if (!this.addedToWorld) {
      return false;
    }
    this.world.dynamicAmmoWorld?.removeRigidBody(this.nativeBody);
    return true;
  }

  /** Undoes `detachFromBroadphaseTemporarily()` - see its own doc. */
  reattachToBroadphase(): void {
    this.world.dynamicAmmoWorld?.addRigidBody(this.nativeBody, this._ownCGsMask, this._interactWithCGsMask);
  }

  /**
   * Bullet's own `ISLAND_SLEEPING` activation-state constant (`btCollisionObject.h`'s
   * `ACTIVE_TAG = 1, ISLAND_SLEEPING = 2, WANTS_DEACTIVATION = 3, DISABLE_DEACTIVATION = 4,
   * DISABLE_SIMULATION = 5`) - not exposed as a named constant by this pinned Ammo.js embind build,
   * only as a plain `number` parameter on `setActivationState`/`forceActivationState`, so it's
   * hardcoded here rather than referenced off the native module.
   */
  private static readonly ISLAND_SLEEPING = 2;

  get isSleeping(): boolean {
    return this.bodyType !== 'static' && !this.nativeBody.isActive();
  }

  wakeUp(): void {
    if (this.bodyType === 'static') {
      return;
    }
    this.nativeBody.activate(true);
  }

  sleep(): void {
    if (this.bodyType === 'static' || !this.canSleep) {
      return;
    }
    // `forceActivationState` (unlike `setActivationState`) writes Bullet's internal activation
    // state directly, so `isActive()`/`isSleeping` above reflect the change immediately rather than
    // waiting for the next `stepSimulation` to notice a deactivation request.
    this.nativeBody.forceActivationState(AmmoRigidBodyComponent.ISLAND_SLEEPING);
  }

  /**
   * Stops the body where it is: clears its forces and velocities in place, without taking it out
   * of the world (no `world.removed$`/`added$`, which would make e.g. `SurfaceFollowingEntity`
   * drop the body's road plane). A dynamic body's interpolation velocities are cleared as well
   * (`setCenterOfMassTransform` copies the now-zero velocities into them).
   */
  resetMotion(): void {
    const zero = AmmoBodyComponent.scratchVector(0, 0, 0);
    this.nativeBody.clearForces();
    this.nativeBody.setLinearVelocity(zero);
    this.nativeBody.setAngularVelocity(zero);
    if (this.bodyType === 'dynamic') {
      this.applyWorldTransform(this.nativeBody.getWorldTransform());
    }
  }

  dispose(): void {
    super.dispose();
    this.onCollisionStart$.complete();
    this.onCollisionEnd$.complete();
  }
}
