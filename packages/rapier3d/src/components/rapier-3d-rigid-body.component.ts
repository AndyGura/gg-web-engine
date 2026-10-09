import {
  BitMask,
  Body3DOptions,
  BodyOptions,
  BodyType,
  CollisionEvent,
  CollisionGroup,
  DebugBody3DSettings,
  Entity3d,
  IRigidBody3dComponent,
  Pnt3,
  Point3,
  Point4,
  Qtrn,
  Shape3DDescriptor,
} from '@gg-web-engine/core';
import {
  Collider,
  ColliderDesc,
  InteractionGroups,
  MassPropsMode,
  Quaternion,
  RigidBody,
  RigidBodyDesc,
  RigidBodyType,
  Vector3,
} from '@dimforge/rapier3d-compat';
import { Observable, Subject } from 'rxjs';
import { Rapier3dWorldComponent } from './rapier-3d-world.component';
import { Rapier3dGgWorld, Rapier3dPhysicsTypeDocRepo } from '../types';
import { inertiaAboutOrigin } from '../mass-properties';

/** Inverse of `Rapier3dFactory.createRigidBodyDescr`'s own `BodyType -> RigidBodyType` mapping -
 * backs `Rapier3dRigidBodyComponent.bodyOptions`. */
function rapierBodyTypeToBodyType(status: RigidBodyType): BodyType {
  switch (status) {
    case RigidBodyType.Fixed:
      return 'static';
    case RigidBodyType.KinematicPositionBased:
      return 'kinematic_pos';
    case RigidBodyType.KinematicVelocityBased:
      return 'kinematic_vel';
    default:
      return 'dynamic';
  }
}

export class Rapier3dRigidBodyComponent implements IRigidBody3dComponent<Rapier3dPhysicsTypeDocRepo> {
  public entity: Entity3d | null = null;

  public get position(): Point3 {
    return Pnt3.clone(this.nativeBody ? this.nativeBody.translation() : this._bodyDescr.translation);
  }

  public set position(value: Point3) {
    if (this.nativeBody) {
      // A `kinematicPositionBased` body must move through `setNextKinematicTranslation` rather
      // than the immediate teleport `setTranslation` does - only that path lets Rapier derive the
      // body's effective velocity for this step and correctly push/wake dynamic bodies in its way
      // (see `BodyOptions.kinematic_pos`'s own doc, and the "plain teleport" pitfall it links to).
      // `kinematicVelocityBased` and `dynamic` bodies keep the immediate teleport - the former is
      // already driven by `linearVelocity` each step, not by `position` writes.
      if (this.nativeBody.bodyType() === RigidBodyType.KinematicPositionBased) {
        this.nativeBody.setNextKinematicTranslation(new Vector3(value.x, value.y, value.z));
      } else {
        this.nativeBody.setTranslation(new Vector3(value.x, value.y, value.z), true);
      }
    } else {
      this._bodyDescr.setTranslation(value.x, value.y, value.z);
    }
  }

  public get rotation(): Point4 {
    return Qtrn.clone(this.nativeBody ? this.nativeBody.rotation() : this._bodyDescr.rotation);
  }

  public set rotation(value: Point4) {
    if (this.nativeBody) {
      // see `position`'s setter above for why a kinematic-position-based body needs the "next
      // kinematic" API instead of an immediate teleport.
      if (this.nativeBody.bodyType() === RigidBodyType.KinematicPositionBased) {
        this.nativeBody.setNextKinematicRotation(new Quaternion(value.x, value.y, value.z, value.w));
      } else {
        this.nativeBody.setRotation(new Quaternion(value.x, value.y, value.z, value.w), true);
      }
    } else {
      this._bodyDescr.setRotation(new Quaternion(value.x, value.y, value.z, value.w));
    }
  }

  get linearVelocity(): Point3 {
    return Pnt3.clone(this.nativeBody ? this.nativeBody.linvel() : this._bodyDescr.linvel);
  }

  set linearVelocity(value: Point3) {
    if (this.nativeBody) {
      // see `position`'s setter above for why `true` (wake up) is required
      this.nativeBody.setLinvel(new Vector3(value.x, value.y, value.z), true);
    }
  }

  /**
   * Rapier keeps an added force until `resetForces` - `Rapier3dWorldComponent.simulate()` resets
   * every body registered in its `forcedBodies` after the last substep of the call, which gives
   * `IRigidBodyComponent.applyForce` its "next `simulate()` call only" lifetime across all of that
   * call's substeps.
   */
  applyForce(force: Point3, worldPoint?: Point3): void {
    if (!this.nativeBody || !this.nativeBody.isDynamic()) {
      return;
    }
    if (worldPoint) {
      this.nativeBody.addForceAtPoint(
        new Vector3(force.x, force.y, force.z),
        new Vector3(worldPoint.x, worldPoint.y, worldPoint.z),
        true,
      );
    } else {
      this.nativeBody.addForce(new Vector3(force.x, force.y, force.z), true);
    }
    this.world.forcedBodies.add(this);
  }

  applyImpulse(impulse: Point3, worldPoint?: Point3): void {
    if (!this.nativeBody || !this.nativeBody.isDynamic()) {
      return;
    }
    if (worldPoint) {
      this.nativeBody.applyImpulseAtPoint(
        new Vector3(impulse.x, impulse.y, impulse.z),
        new Vector3(worldPoint.x, worldPoint.y, worldPoint.z),
        true,
      );
    } else {
      this.nativeBody.applyImpulse(new Vector3(impulse.x, impulse.y, impulse.z), true);
    }
  }

  applyTorque(torque: Point3): void {
    if (!this.nativeBody || !this.nativeBody.isDynamic()) {
      return;
    }
    this.nativeBody.addTorque(new Vector3(torque.x, torque.y, torque.z), true);
    this.world.forcedBodies.add(this);
  }

  applyTorqueImpulse(torqueImpulse: Point3): void {
    if (!this.nativeBody || !this.nativeBody.isDynamic()) {
      return;
    }
    this.nativeBody.applyTorqueImpulse(new Vector3(torqueImpulse.x, torqueImpulse.y, torqueImpulse.z), true);
  }

  /** @internal `Rapier3dWorldComponent.simulate()`: drops this tick's `applyForce`/`applyTorque` accumulation. */
  resetAppliedForces(): void {
    this.nativeBody?.resetForces(false);
    this.nativeBody?.resetTorques(false);
  }

  get angularVelocity(): Point3 {
    return Pnt3.clone(this.nativeBody ? this.nativeBody.angvel() : this._bodyDescr.angvel);
  }

  set angularVelocity(value: Point3) {
    if (this.nativeBody) {
      // see `position`'s setter above for why `true` (wake up) is required
      this.nativeBody.setAngvel(new Vector3(value.x, value.y, value.z), true);
    }
  }

  readonly debugBodySettings: DebugBody3DSettings = new DebugBody3DSettings(
    this._bodyDescr.status == RigidBodyType.Fixed
      ? { type: 'RIGID_STATIC' }
      : this._bodyDescr.status == RigidBodyType.Dynamic
        ? { type: 'RIGID_DYNAMIC', sleeping: () => this.isSleeping }
        : { type: 'RIGID_KINEMATIC' },
    this.shape,
  );

  /**
   * See `IRigidBodyComponent.bodyOptions`'s own doc. Reads straight off `_bodyDescr`/
   * `_colliderDescr`/`_colliderOptions` (also what `addToWorld` itself builds the native body/
   * colliders from, and what `factoryProps`/`clone()` already round-trip) rather than the native
   * body/colliders - this engine's own API never mutates any of `bodyType`/`mass`/`friction`/
   * `restitution`/`ccd` after construction, so the stored descriptor is exactly as accurate as a
   * native query would be.
   *
   * `mass` is **not** `_bodyDescr.mass` - unlike `packages/rapier2d`, `Rapier3dFactory.createRigidBodyDescr`
   * deliberately sets mass on each collider (`ColliderDesc.setMass`), not on the body descriptor
   * (see that method's own doc for why: a `RigidBodyDesc.mass` is "additional" point mass with no
   * rotational inertia of its own, wrong for a body whose inertia should scale with its actual
   * mass). `_bodyDescr.mass` is therefore always its unused default (`0`) regardless of what was
   * actually requested - the real total is the sum of every collider's own `mass`, which
   * `ColliderDesc` only carries meaningfully once `setMass`/`setMassProperties` was actually called
   * on it (true for every collider of a `dynamic` body, per `createRigidBodyDescr`; a `static`/
   * `kinematic_*` body never calls either, so this correctly sums to `0` for one of those instead).
   */
  get bodyOptions(): Readonly<BodyOptions> {
    return {
      bodyType: rapierBodyTypeToBodyType(this._bodyDescr.status),
      mass: this._colliderDescr.reduce(
        (sum, cd) => sum + (cd.massPropsMode !== MassPropsMode.Density ? cd.mass : 0),
        0,
      ),
      friction: this._colliderOptions.friction,
      restitution: this._colliderOptions.restitution,
      ccd: this._bodyDescr.ccdEnabled,
      canSleep: this._bodyDescr.canSleep,
      ownCollisionGroups: this.ownCollisionGroups,
      interactWithCollisionGroups: this.interactWithCollisionGroups,
    };
  }

  protected _nativeBody: RigidBody | null = null;
  protected _nativeBodyColliders: Collider[] | null = null;

  get nativeBody(): RigidBody | null {
    return this._nativeBody;
  }

  set nativeBody(value: RigidBody | null) {
    if (value == this._nativeBody || !value) {
      return;
    }
    this._nativeBody = value;
  }

  public name: string = '';

  /**
   * Other rigid-body components this one is currently touching via a real (non-sensor) contact -
   * mirrors `Rapier3dTriggerComponent.overlaps`, but symmetric: both sides of an ordinary collision
   * get notified, so both sides track it. Populated/drained by `Rapier3dWorldComponent`'s centralized
   * collision-event dispatch (see `notifyCollisionStart`/`notifyCollisionEnd` below), and consulted by
   * `removeFromWorld` to emit `onCollisionEnd(null)` to any partner still touching this body at the
   * moment it's removed (per `CollisionEvent`'s "null when the other body was removed from the world
   * while still in contact" convention) - Rapier does not reliably emit a native collision-stop event
   * for a collider that's simply deleted mid-contact (same reason `Rapier3dTriggerComponent.
   * checkOverlaps` has its own manual `!body.nativeBody` cleanup pass instead of trusting the event
   * queue for that case).
   */
  public readonly collidingWith: Set<Rapier3dRigidBodyComponent> = new Set();

  protected readonly onCollisionStart$: Subject<CollisionEvent<Point3, Rapier3dRigidBodyComponent>> = new Subject<
    CollisionEvent<Point3, Rapier3dRigidBodyComponent>
  >();
  protected readonly onCollisionEnd$: Subject<Rapier3dRigidBodyComponent | null> =
    new Subject<Rapier3dRigidBodyComponent | null>();

  get onCollisionStart(): Observable<CollisionEvent<Point3, Rapier3dRigidBodyComponent>> {
    return this.onCollisionStart$.asObservable();
  }

  get onCollisionEnd(): Observable<Rapier3dRigidBodyComponent | null> {
    return this.onCollisionEnd$.asObservable();
  }

  /**
   * Called by `Rapier3dWorldComponent`'s centralized collision-event dispatch (see
   * `Rapier3dWorldComponent.simulate`) - not meant to be called by app code directly. Kept `public`
   * (rather than some cross-class-accessible `protected`) purely because the dispatching class isn't
   * a subclass of this one; there's nothing else in this package it's meant to be called from.
   */
  public notifyCollisionStart(event: CollisionEvent<Point3, Rapier3dRigidBodyComponent>): void {
    this.collidingWith.add(event.otherBody);
    this.onCollisionStart$.next(event);
  }

  /** See `notifyCollisionStart`'s doc. `otherBody: null` signals the partner was removed from the
   *  world while still in contact, per `onCollisionEnd`'s doc. */
  public notifyCollisionEnd(otherBody: Rapier3dRigidBodyComponent | null): void {
    if (otherBody) {
      this.collidingWith.delete(otherBody);
    }
    this.onCollisionEnd$.next(otherBody);
  }

  public get factoryProps(): [
    ColliderDesc[],
    Shape3DDescriptor,
    RigidBodyDesc,
    Omit<Omit<Body3DOptions, 'bodyType'>, 'mass'>,
  ] {
    const colliderDescr = this._colliderDescr.map(cd => {
      const d = new ColliderDesc(cd.shape);
      d.setTranslation(cd.translation.x, cd.translation.y, cd.translation.z);
      d.setRotation({ ...cd.rotation });
      // `cd.mass`/`centerOfMass`/`principalAngularInertia`/`angularInertiaLocalFrame` are only
      // meaningful once something has actually switched `cd` into `MassPropsMode.MassProps` (via
      // `setMassProperties`) or `.Mass` (via `setMass`/`ColliderDesc.mass`) - otherwise they're just
      // a freshly-constructed `ColliderDesc`'s zeroed placeholder defaults (confirmed empirically:
      // `mass: 0`, `principalAngularInertia: {0,0,0}`), irrelevant under the default
      // `MassPropsMode.Density` mode, which instead derives mass *and* rotational inertia
      // automatically from the shape and `cd.density`. Unconditionally copying those placeholders via
      // `setMassProperties` here used to force every `factoryProps`-built collider (every `clone()`,
      // and - since `Rapier3dRaycastVehicleComponent` builds its own body this same way - every
      // raycast vehicle chassis) into an explicit zero-mass, zero-rotational-inertia `MassProps` mode
      // regardless of the original's real mode, silently discarding the shape-derived inertia tensor
      // a normal `factory.createRigidBody()` body gets for free. The practical symptom this caused:
      // Rapier's own solver reduces "torque / (zero-plus-epsilon) angular inertia" to no angular
      // acceleration at all, so a vehicle chassis built this way could never yaw - confirmed
      // empirically (steering a vehicle chassis produced pure sideways-sliding translation with
      // `angvel` staying exactly `{0,0,0}` every tick, never even a small nonzero value, which a
      // merely-large-but-nonzero inertia tensor would still have produced). Fix: only propagate
      // explicit mass properties when the original was actually in one of those two modes; otherwise
      // just copy `density` and let Rapier re-derive mass/inertia from the (identical) shape, exactly
      // like the original was computed.
      if (cd.massPropsMode === MassPropsMode.MassProps) {
        d.setMassProperties(cd.mass, cd.centerOfMass, cd.principalAngularInertia, cd.angularInertiaLocalFrame);
      } else if (cd.massPropsMode === MassPropsMode.Mass) {
        d.setMass(cd.mass);
      } else {
        d.setDensity(cd.density);
      }
      d.setFriction(cd.friction);
      d.setEnabled(cd.enabled);
      d.setRestitution(cd.restitution);
      // the factory turns on collision events (and sensors set `isSensor`); a clone must keep them,
      // or it never reports collisions or trigger overlaps
      d.setActiveEvents(cd.activeEvents);
      d.setActiveCollisionTypes(cd.activeCollisionTypes);
      d.setSensor(cd.isSensor);
      return d;
    });
    const bd = new RigidBodyDesc(this._bodyDescr.status);
    bd.mass = this._bodyDescr.mass;
    bd.setTranslation(this._bodyDescr.translation.x, this._bodyDescr.translation.y, this._bodyDescr.translation.z);
    bd.setRotation({ ...this._bodyDescr.rotation });
    // `ccdEnabled` is a plain field on `RigidBodyDesc` (not copied by the constructor above), not
    // just a constructor-only `setCcdEnabled` call - carry it over explicitly so `clone()` doesn't
    // silently drop CCD off the copy.
    bd.setCcdEnabled(this._bodyDescr.ccdEnabled);
    bd.setCanSleep(this._bodyDescr.canSleep);
    // `removeFromWorld` stores the live velocities on `_bodyDescr` so a re-added body resumes its
    // motion; a copy built from an out-of-world body must start with the same velocities, or the
    // clone would spawn at rest where the original re-adds in motion.
    bd.setLinvel(this._bodyDescr.linvel.x, this._bodyDescr.linvel.y, this._bodyDescr.linvel.z);
    bd.setAngvel(new Vector3(this._bodyDescr.angvel.x, this._bodyDescr.angvel.y, this._bodyDescr.angvel.z));
    return [colliderDescr, this.shape, bd, this._colliderOptions];
  }

  constructor(
    protected readonly world: Rapier3dWorldComponent,
    protected _colliderDescr: ColliderDesc[],
    public readonly shape: Shape3DDescriptor,
    protected _bodyDescr: RigidBodyDesc,
    protected _colliderOptions: Omit<Omit<Body3DOptions, 'bodyType'>, 'mass'>,
  ) {
    this.ownCollisionGroups = _colliderOptions?.ownCollisionGroups || [world.mainCollisionGroup];
    this.interactWithCollisionGroups = _colliderOptions?.interactWithCollisionGroups || [world.mainCollisionGroup];
  }

  protected collisionGroups: InteractionGroups = BitMask.full(32);

  get interactWithCollisionGroups(): ReadonlyArray<CollisionGroup> {
    return BitMask.unpack(this.collisionGroups, 16);
  }

  set interactWithCollisionGroups(value: ReadonlyArray<CollisionGroup> | 'all') {
    let mask;
    if (value === 'all') {
      mask = BitMask.full(16);
    } else {
      mask = BitMask.pack(value, 16);
    }
    mask = mask | (this.collisionGroups & (BitMask.full(16) << 16));
    if (mask === this.collisionGroups) {
      return;
    }
    this.collisionGroups = mask;
    if (this.nativeBody) {
      for (let i = 0; i < this.nativeBody.numColliders(); i++) {
        this.nativeBody.collider(i).setCollisionGroups(this.collisionGroups);
      }
    }
  }

  get ownCollisionGroups(): ReadonlyArray<CollisionGroup> {
    return BitMask.unpack(this.collisionGroups >> 16, 16);
  }

  set ownCollisionGroups(value: ReadonlyArray<CollisionGroup> | 'all') {
    let mask;
    if (value === 'all') {
      mask = BitMask.full(16);
    } else {
      mask = BitMask.pack(value, 16);
    }
    mask = (mask << 16) | (this.collisionGroups & BitMask.full(16));
    if (mask === this.collisionGroups) {
      return;
    }
    this.collisionGroups = mask;
    if (this.nativeBody) {
      for (let i = 0; i < this.nativeBody.numColliders(); i++) {
        this.nativeBody.collider(i).setCollisionGroups(this.collisionGroups);
      }
    }
  }

  clone(): Rapier3dRigidBodyComponent {
    const comp = new Rapier3dRigidBodyComponent(this.world, ...this.factoryProps);
    comp.collisionGroups = this.collisionGroups;
    return comp;
  }

  addToWorld(world: Rapier3dGgWorld): void {
    if (world.physicsWorld != this.world) {
      throw new Error('Rapier3D bodies cannot be shared between different worlds');
    }
    this._nativeBody = this.world.nativeWorld!.createRigidBody(this._bodyDescr);
    this._nativeBodyColliders = this._colliderDescr.map(c => {
      const col = this.world.nativeWorld!.createCollider(c, this._nativeBody!);
      col.setFriction(this._colliderOptions.friction);
      col.setRestitution(this._colliderOptions.restitution);
      col.setCollisionGroups(this.collisionGroups);
      return col;
    });
    if (this._bodyDescr.status === RigidBodyType.Dynamic) {
      this.applyMassProperties(this._nativeBody, this._nativeBodyColliders);
    }
    this.world.handleIdEntityMap.set(this._nativeBody!.handle, this);
    this.world.added$.next(this);
  }

  /**
   * Places a dynamic body's centre of mass at its origin, as `BodyOptions.mass` documents it for 3D
   * (Bullet's compound shape does this natively). Rapier derives the centre of
   * mass from the colliders instead, which for a compound shape (a car chassis built from a few
   * boxes) lands wherever the boxes average out - often far above the wheels. The total mass is
   * spread over the colliders by volume (uniform density), the resulting inertia is moved to the
   * origin (parallel-axis theorem), and the body carries it as its own mass properties with
   * massless colliders.
   */
  private applyMassProperties(body: RigidBody, colliders: Collider[]): void {
    const total = colliders.reduce((sum, c) => sum + c.mass(), 0);
    if (colliders.length > 1) {
      const volumes = colliders.map(c => c.volume());
      const volume = volumes.reduce((a, b) => a + b, 0);
      if (volume > 0) {
        colliders.forEach((c, i) => c.setMass((total * volumes[i]) / volume));
      }
    }
    body.recomputeMassPropertiesFromColliders();
    const com = body.localCom();
    if (Pnt3.len(com) < 1e-6) {
      return;
    }
    const { principal, frame } = inertiaAboutOrigin(
      body.mass(),
      com,
      body.principalInertia(),
      body.principalInertiaLocalFrame(),
    );
    colliders.forEach(c => c.setMass(0));
    body.setAdditionalMassProperties(
      total,
      new Vector3(0, 0, 0),
      new Vector3(principal.x, principal.y, principal.z),
      new Quaternion(frame.x, frame.y, frame.z, frame.w),
      false,
    );
    body.recomputeMassPropertiesFromColliders();
  }

  removeFromWorld(world: Rapier3dGgWorld, dispose?: boolean): void {
    if (world.physicsWorld != this.world) {
      throw new Error('Rapier3D bodies cannot be shared between different worlds');
    }
    // notify every body still touching this one that the contact ended because *this* body vanished
    // (not because they physically separated) - see `collidingWith`'s doc.
    for (const other of this.collidingWith) {
      other.collidingWith.delete(this);
      other.notifyCollisionEnd(null);
    }
    this.collidingWith.clear();
    if (this._nativeBody) {
      // `addToWorld` rebuilds the native body from `_bodyDescr`, and the getters fall back to it
      // while the body is out of the world: carry the live state over, or a body re-added later
      // (an entity reparented, or hidden by a network layer) would reappear at its spawn pose.
      const t = this._nativeBody.translation();
      const r = this._nativeBody.rotation();
      const lv = this._nativeBody.linvel();
      const av = this._nativeBody.angvel();
      this._bodyDescr.setTranslation(t.x, t.y, t.z);
      this._bodyDescr.setRotation(new Quaternion(r.x, r.y, r.z, r.w));
      this._bodyDescr.setLinvel(lv.x, lv.y, lv.z);
      this._bodyDescr.setAngvel(new Vector3(av.x, av.y, av.z));
      for (const col of this._nativeBodyColliders!) {
        this.world.nativeWorld!.removeCollider(col, false);
      }
      this.world.nativeWorld!.removeRigidBody(this._nativeBody);
      this.world.handleIdEntityMap.delete(this._nativeBody.handle);
      this._nativeBody = null;
      this._nativeBodyColliders = null;
    }
    this.world.removed$.next(this);
  }

  resetMotion(): void {
    this._nativeBody!.setAngvel(new Vector3(0, 0, 0), false);
    this._nativeBody!.setLinvel(new Vector3(0, 0, 0), false);
  }

  get isSleeping(): boolean {
    return this._bodyDescr.status !== RigidBodyType.Fixed && !!this._nativeBody?.isSleeping();
  }

  wakeUp(): void {
    if (this._bodyDescr.status === RigidBodyType.Fixed) {
      return;
    }
    this._nativeBody?.wakeUp();
  }

  sleep(): void {
    if (this._bodyDescr.status === RigidBodyType.Fixed || !this._bodyDescr.canSleep) {
      return;
    }
    this._nativeBody?.sleep();
  }

  dispose(): void {
    if (this.nativeBody) {
      this.removeFromWorld({ physicsWorld: this.world } as any as Rapier3dGgWorld, true);
    }
    this.onCollisionStart$.complete();
    this.onCollisionEnd$.complete();
  }
}
