import { AmmoWorldComponent } from './ammo-world.component';
import Ammo from '../ammo.js/ammo';
import { AmmoBodyComponent } from './ammo-body.component';
import {
  BodyType,
  CollisionEvent,
  DebugBody3DSettings,
  Entity3d,
  IRigidBody3dComponent,
  Point3,
  Shape3DDescriptor,
} from '@gg-web-engine/core';
import { first, Observable, Subject } from 'rxjs';
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
    this.nativeBody.setLinearVelocity(new Ammo.btVector3(value.x, value.y, value.z));
    this.nativeBody.activate(true);
  }

  get angularVelocity(): Point3 {
    const v = this.nativeBody.getAngularVelocity();
    return { x: v.x(), y: v.y(), z: v.z() };
  }

  set angularVelocity(value: Point3) {
    this.nativeBody.setAngularVelocity(new Ammo.btVector3(value.x, value.y, value.z));
    this.nativeBody.activate(true);
  }

  readonly debugBodySettings: DebugBody3DSettings = new DebugBody3DSettings(
    this._nativeBody.isStaticObject()
      ? { type: 'RIGID_STATIC' }
      : this._nativeBody.isKinematicObject()
        ? { type: 'RIGID_KINEMATIC' }
        : { type: 'RIGID_DYNAMIC', sleeping: () => !this._nativeBody.isActive() },
    this.shape,
  );

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
    /**
     * `kinematic_pos` vs `kinematic_vel` is an adapter-level bookkeeping distinction with no
     * native Bullet equivalent - both set the exact same `CF_KINEMATIC_OBJECT` flag (see
     * `AmmoFactory.createRigidBodyFromShape`), so unlike `static`/`dynamic` it can't be recovered
     * by reading the native body back (`isKinematicObject()` can't tell the two apart). Stored
     * here instead, purely so `clone()` and `AmmoWorldComponent`'s `kinematic_vel` velocity
     * integration (see `registerKinematicVelBody`) know which one this body actually is.
     */
    public readonly bodyType: BodyType = 'dynamic',
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

  resetMotion(): void {
    const emptyVector = new Ammo.btVector3();
    if (!this.addedToWorld) {
      this.nativeBody.clearForces();
      this.nativeBody.setLinearVelocity(emptyVector);
      this.nativeBody.setAngularVelocity(emptyVector);
    } else {
      // when resetting object motion state in ammo.js while it's added to the simulation,
      // on the next tick it randomly gets broken (linear velocity vector has NaN components and then position too)
      // By removing and adding the object to the world it happens less often
      const ammoWorld = this.world;
      this.removeFromWorld({ physicsWorld: ammoWorld } as any);
      const position = this.position;
      const rotation = this.rotation;
      this.nativeBody.clearForces();
      this.nativeBody.setLinearVelocity(emptyVector);
      this.nativeBody.setAngularVelocity(emptyVector);
      this.world.afterTick$.pipe(first()).subscribe(() => {
        this.addToWorld({ physicsWorld: ammoWorld } as any);
        const newLinVel = this.linearVelocity;
        if (isNaN(newLinVel.x) || isNaN(newLinVel.y) || isNaN(newLinVel.z)) {
          console.warn('resetMotion caused ammo body to have broken velocity. Fixing');
          this.position = position;
          this.rotation = rotation;
          this.resetMotion();
        }
      });
    }
    Ammo.destroy(emptyVector);
  }

  dispose(): void {
    super.dispose();
    this.onCollisionStart$.complete();
    this.onCollisionEnd$.complete();
  }
}
