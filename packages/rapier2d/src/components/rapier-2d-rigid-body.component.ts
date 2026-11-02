import {
  BitMask,
  Body2DOptions,
  BodyOptions,
  BodyType,
  CollisionEvent,
  CollisionGroup,
  DebugBody2DSettings,
  Entity2d,
  IRigidBody2dComponent,
  Pnt2,
  Point2,
  Shape2DDescriptor,
} from '@gg-web-engine/core';
import {
  Collider,
  ColliderDesc,
  InteractionGroups,
  MassPropsMode,
  RigidBody,
  RigidBodyDesc,
  RigidBodyType,
  Vector2,
} from '@dimforge/rapier2d-compat';
import { Observable, Subject } from 'rxjs';
import { Rapier2dWorldComponent } from './rapier-2d-world.component';
import { Rapier2dGgWorld, Rapier2dPhysicsTypeDocRepo } from '../types';

/** Inverse of `Rapier2dFactory.createRigidBodyDescr`'s own `BodyType -> RigidBodyType` mapping -
 * backs `Rapier2dRigidBodyComponent.bodyOptions`. */
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

export class Rapier2dRigidBodyComponent implements IRigidBody2dComponent<Rapier2dPhysicsTypeDocRepo> {
  public entity: Entity2d | null = null;

  public get position(): Point2 {
    return Pnt2.clone(this.nativeBody ? this.nativeBody.translation() : this._bodyDescr.translation);
  }

  public set position(value: Point2) {
    if (this.nativeBody) {
      // A `kinematicPositionBased` body must move through `setNextKinematicTranslation` rather
      // than the immediate teleport `setTranslation` does - only that path lets Rapier derive the
      // body's effective velocity for this step and correctly push/wake dynamic bodies in its way
      // (see `BodyOptions.kinematic_pos`'s own doc, and the "plain teleport" pitfall it links to).
      // `kinematicVelocityBased` and `dynamic` bodies keep the immediate teleport - the former is
      // already driven by `linearVelocity` each step, not by `position` writes.
      if (this.nativeBody.bodyType() === RigidBodyType.KinematicPositionBased) {
        this.nativeBody.setNextKinematicTranslation(new Vector2(value.x, value.y));
      } else {
        this.nativeBody.setTranslation(new Vector2(value.x, value.y), true);
      }
    } else {
      this._bodyDescr.setTranslation(value.x, value.y);
    }
  }

  public get rotation(): number {
    return this.nativeBody ? this.nativeBody.rotation() : this._bodyDescr.rotation;
  }

  public set rotation(value: number) {
    if (this.nativeBody) {
      // see `position`'s setter above for why a kinematic-position-based body needs the "next
      // kinematic" API instead of an immediate teleport.
      if (this.nativeBody.bodyType() === RigidBodyType.KinematicPositionBased) {
        this.nativeBody.setNextKinematicRotation(value);
      } else {
        this.nativeBody.setRotation(value, true);
      }
    } else {
      this._bodyDescr.setRotation(value);
    }
  }

  get linearVelocity(): Point2 {
    return Pnt2.clone(this.nativeBody ? this.nativeBody.linvel() : this._bodyDescr.linvel);
  }

  set linearVelocity(value: Point2) {
    if (this.nativeBody) {
      this.nativeBody.setLinvel(new Vector2(value.x, value.y), true);
    }
  }

  /**
   * Rapier keeps an added force until `resetForces` - `Rapier2dWorldComponent.simulate()` resets
   * every body registered in its `forcedBodies` after stepping, which gives
   * `IRigidBodyComponent.applyForce` its "next `simulate()` call only" lifetime.
   */
  applyForce(force: Point2, worldPoint?: Point2): void {
    if (!this.nativeBody || !this.nativeBody.isDynamic()) {
      return;
    }
    if (worldPoint) {
      this.nativeBody.addForceAtPoint(new Vector2(force.x, force.y), new Vector2(worldPoint.x, worldPoint.y), true);
    } else {
      this.nativeBody.addForce(new Vector2(force.x, force.y), true);
    }
    this.world.forcedBodies.add(this);
  }

  applyImpulse(impulse: Point2, worldPoint?: Point2): void {
    if (!this.nativeBody || !this.nativeBody.isDynamic()) {
      return;
    }
    if (worldPoint) {
      this.nativeBody.applyImpulseAtPoint(
        new Vector2(impulse.x, impulse.y),
        new Vector2(worldPoint.x, worldPoint.y),
        true,
      );
    } else {
      this.nativeBody.applyImpulse(new Vector2(impulse.x, impulse.y), true);
    }
  }

  applyTorque(torque: number): void {
    if (!this.nativeBody || !this.nativeBody.isDynamic()) {
      return;
    }
    this.nativeBody.addTorque(torque, true);
    this.world.forcedBodies.add(this);
  }

  applyTorqueImpulse(torqueImpulse: number): void {
    if (!this.nativeBody || !this.nativeBody.isDynamic()) {
      return;
    }
    this.nativeBody.applyTorqueImpulse(torqueImpulse, true);
  }

  /** @internal `Rapier2dWorldComponent.simulate()`: drops this tick's `applyForce`/`applyTorque` accumulation. */
  resetAppliedForces(): void {
    this.nativeBody?.resetForces(false);
    this.nativeBody?.resetTorques(false);
  }

  get angularVelocity(): number {
    return this.nativeBody ? this.nativeBody.angvel() : this._bodyDescr.angvel;
  }

  set angularVelocity(value: number) {
    if (this.nativeBody) {
      this.nativeBody.setAngvel(value, true);
    }
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

  protected readonly onCollisionStart$: Subject<CollisionEvent<Point2, Rapier2dRigidBodyComponent>> = new Subject<
    CollisionEvent<Point2, Rapier2dRigidBodyComponent>
  >();
  protected readonly onCollisionEnd$: Subject<Rapier2dRigidBodyComponent | null> =
    new Subject<Rapier2dRigidBodyComponent | null>();

  /**
   * Other rigid-body components this one is currently touching via a real (non-sensor) contact -
   * mirrors `Rapier2dTriggerComponent.overlaps`, but symmetric: both sides of an ordinary collision
   * get notified, so both sides track it. Populated/drained by `Rapier2dWorldComponent`'s centralized
   * collision-event dispatch (see `notifyCollisionStart`/`notifyCollisionEnd` below), and consulted by
   * `removeFromWorld` to emit `onCollisionEnd(null)` to any partner still touching this body at the
   * moment it's removed (per `CollisionEvent`'s "null when the other body was removed from the world
   * while still in contact" convention) - the native stop Rapier reports for a collider deleted
   * mid-contact arrives under a handle that no longer resolves to this body (see the world's
   * event dispatch), so the partner would otherwise never hear that the contact ended.
   *
   * Each partner maps to how many collider pairs of the two bodies touch right now. Rapier reports
   * contacts per collider, so a `COMPOUND` body (one collider per part) touching another body with
   * two parts gets two native starts, and a stop whenever one part lets go while the other still
   * touches. `onCollisionStart` fires only when the count goes from 0 to 1 and `onCollisionEnd`
   * only when it returns to 0: one start and one end per body pair, as the contract says.
   */
  public readonly collidingWith: Map<Rapier2dRigidBodyComponent, number> = new Map();

  get onCollisionStart(): Observable<CollisionEvent<Point2, Rapier2dRigidBodyComponent>> {
    return this.onCollisionStart$.asObservable();
  }

  get onCollisionEnd(): Observable<Rapier2dRigidBodyComponent | null> {
    return this.onCollisionEnd$.asObservable();
  }

  /**
   * Called by `Rapier2dWorldComponent`'s centralized collision-event dispatch (see
   * `Rapier2dWorldComponent.simulate`) - not meant to be called by app code directly. Kept `public`
   * (rather than some cross-class-accessible `protected`) purely because the dispatching class isn't
   * a subclass of this one; there's nothing else in this package it's meant to be called from.
   */
  public notifyCollisionStart(event: CollisionEvent<Point2, Rapier2dRigidBodyComponent>): void {
    if (this.trackCollisionStart(event.otherBody)) {
      this.emitCollisionStart(event);
    }
  }

  /**
   * First half of `notifyCollisionStart`, the bookkeeping: counts one more touching pair with
   * `otherBody` and tells whether that was the first (an `onCollisionStart` is due). The world's
   * dispatch counts both sides of a pair before it emits to either, so a subscriber of the first
   * side that removes the second finds the second's own `collidingWith` already holding the first
   * and `removeFromWorld` tells the first that the contact ended.
   */
  public trackCollisionStart(otherBody: Rapier2dRigidBodyComponent): boolean {
    const touching = this.collidingWith.get(otherBody) ?? 0;
    this.collidingWith.set(otherBody, touching + 1);
    return touching === 0;
  }

  /** Second half of `notifyCollisionStart`: emits `onCollisionStart`, after `trackCollisionStart` said to. */
  public emitCollisionStart(event: CollisionEvent<Point2, Rapier2dRigidBodyComponent>): void {
    this.onCollisionStart$.next(event);
  }

  /** See `notifyCollisionStart`'s doc. `otherBody: null` signals the partner was removed from the
   *  world while still in contact, per `onCollisionEnd`'s doc. A stop of one collider pair while
   *  another pair of the same two bodies still touches emits nothing (see `collidingWith`). */
  public notifyCollisionEnd(otherBody: Rapier2dRigidBodyComponent | null): void {
    if (!otherBody || this.trackCollisionEnd(otherBody)) {
      this.emitCollisionEnd(otherBody);
    }
  }

  /**
   * First half of `notifyCollisionEnd` for a partner still in the world, the bookkeeping: one fewer
   * touching pair with `otherBody`; tells whether that was the last (an `onCollisionEnd` is due).
   * `false` as well for a partner with no count (no start was reported for the pair - it began
   * before a re-add, say).
   */
  public trackCollisionEnd(otherBody: Rapier2dRigidBodyComponent): boolean {
    const touching = this.collidingWith.get(otherBody);
    if (touching === undefined) {
      return false;
    }
    if (touching > 1) {
      this.collidingWith.set(otherBody, touching - 1);
      return false;
    }
    this.collidingWith.delete(otherBody);
    return true;
  }

  /** Second half of `notifyCollisionEnd`: emits `onCollisionEnd` (`null` for a removed partner). */
  public emitCollisionEnd(otherBody: Rapier2dRigidBodyComponent | null): void {
    this.onCollisionEnd$.next(otherBody);
  }

  public get factoryProps(): [
    ColliderDesc[],
    Shape2DDescriptor,
    RigidBodyDesc,
    Omit<Omit<Body2DOptions, 'bodyType'>, 'mass'>,
  ] {
    const colliderDescr = this._colliderDescr.map(cd => {
      const d = new ColliderDesc(cd.shape);
      d.setTranslation(cd.translation.x, cd.translation.y);
      d.setRotation(cd.rotation);
      // `cd.mass`/`centerOfMass`/`principalAngularInertia` only carry a meaningful value once
      // `setMassProperties` (`MassPropsMode.MassProps`) or `setMass` (`MassPropsMode.Mass`) switched
      // `cd` out of the default `MassPropsMode.Density` mode, where they're zeroed placeholders and
      // Rapier derives mass and inertia from the shape and `cd.density` instead. Copying the
      // placeholders through `setMassProperties` would hand the copy an explicit zero inertia, so
      // the copy only takes over what the original's own mode actually uses.
      if (cd.massPropsMode === MassPropsMode.MassProps) {
        d.setMassProperties(cd.mass, cd.centerOfMass, cd.principalAngularInertia);
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
    // `ccdEnabled`/`canSleep` are plain fields on `RigidBodyDesc` (not copied by the constructor
    // above) - carry them over explicitly so `clone()` doesn't silently drop them off the copy.
    bd.setCcdEnabled(this._bodyDescr.ccdEnabled);
    bd.setCanSleep(this._bodyDescr.canSleep);
    // The copy starts where the original is right now, moving as it moves. `_bodyDescr` only holds
    // the live pose and velocities while the body is out of the world (`removeFromWorld` stores
    // them there, `addToWorld` rebuilds from them); while it is in the world the native body is
    // the one source of its state, so a clone of an in-world body reads it, or it would spawn at
    // the original's spawn pose, at rest.
    const native = this._nativeBody;
    const t = native ? native.translation() : this._bodyDescr.translation;
    const lv = native ? native.linvel() : this._bodyDescr.linvel;
    bd.setTranslation(t.x, t.y);
    bd.setRotation(native ? native.rotation() : this._bodyDescr.rotation);
    bd.setLinvel(lv.x, lv.y);
    bd.setAngvel(native ? native.angvel() : this._bodyDescr.angvel);
    return [colliderDescr, this.shape, bd, this._colliderOptions];
  }

  readonly debugBodySettings: DebugBody2DSettings = new DebugBody2DSettings(
    this._bodyDescr.status == RigidBodyType.Fixed
      ? { type: 'RIGID_STATIC' }
      : this._bodyDescr.status == RigidBodyType.Dynamic
        ? { type: 'RIGID_DYNAMIC', sleeping: () => this.isSleeping }
        : { type: 'RIGID_KINEMATIC' },
    this.shape,
  );

  /**
   * See `IRigidBodyComponent.bodyOptions`'s own doc. Reads straight off `_bodyDescr`/
   * `_colliderOptions` (also what `addToWorld` itself builds the native body/colliders from, and
   * what `factoryProps`/`clone()` already round-trip) rather than the native body/colliders - this
   * engine's own API never mutates any of `bodyType`/`mass`/`friction`/`restitution`/`ccd` after
   * construction, so the stored descriptor is exactly as accurate as a native query would be.
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

  constructor(
    protected readonly world: Rapier2dWorldComponent,
    protected _colliderDescr: ColliderDesc[],
    public readonly shape: Shape2DDescriptor,
    protected _bodyDescr: RigidBodyDesc,
    protected _colliderOptions: Omit<Omit<Body2DOptions, 'bodyType'>, 'mass'>,
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

  clone(): Rapier2dRigidBodyComponent {
    const comp = new Rapier2dRigidBodyComponent(this.world, ...this.factoryProps);
    comp.collisionGroups = this.collisionGroups;
    return comp;
  }

  addToWorld(world: Rapier2dGgWorld): void {
    if (world.physicsWorld != this.world) {
      throw new Error(
        "Rapier2D bodies cannot be shared between different worlds: this one was created by another world's factory. " +
          'Create it with the factory of the world it is added to (`world.physicsWorld.factory`).',
      );
    }
    this._nativeBody = this.world.nativeWorld!.createRigidBody(this._bodyDescr);
    this._nativeBodyColliders = this._colliderDescr.map(c => {
      const col = this.world.nativeWorld!.createCollider(c, this._nativeBody!);
      col.setFriction(this._colliderOptions.friction);
      col.setRestitution(this._colliderOptions.restitution);
      col.setCollisionGroups(this.collisionGroups);
      return col;
    });
    this.world.handleIdEntityMap.set(this._nativeBody!.handle, this);
    this.world.added$.next(this);
  }

  // `dispose` is accepted for interface conformance but doesn't change behavior below: this method
  // already unconditionally frees the native rigid body/colliders regardless of the flag, by
  // design - `addToWorld` always recreates them fresh from the stored `_bodyDescr`/`_colliderDescr`
  // descriptors, so eagerly freeing on every removal (rather than only when `dispose: true`) is both
  // safe and cheap to undo, unlike e.g. Ammo's native handles (see `gg-engine-physics-adapter`'s
  // dispose-contract section for that contrast).
  removeFromWorld(world: Rapier2dGgWorld, dispose?: boolean): void {
    if (world.physicsWorld != this.world) {
      throw new Error(
        "Rapier2D bodies cannot be shared between different worlds: this one was created by another world's factory. " +
          'Create it with the factory of the world it is added to (`world.physicsWorld.factory`).',
      );
    }
    // notify every body still touching this one that the contact ended because *this* body vanished
    // (not because they physically separated) - see `collidingWith`'s doc.
    for (const other of this.collidingWith.keys()) {
      other.collidingWith.delete(this);
      other.notifyCollisionEnd(null);
    }
    this.collidingWith.clear();
    if (this._nativeBody) {
      // `addToWorld` rebuilds the native body from `_bodyDescr`, and the getters fall back to it
      // while the body is out of the world: carry the live state over, or a body re-added later
      // (an entity reparented, or hidden by a network layer) would reappear at its spawn pose.
      const t = this._nativeBody.translation();
      const lv = this._nativeBody.linvel();
      this._bodyDescr.setTranslation(t.x, t.y);
      this._bodyDescr.setRotation(this._nativeBody.rotation());
      this._bodyDescr.setLinvel(lv.x, lv.y);
      this._bodyDescr.setAngvel(this._nativeBody.angvel());
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
    this._nativeBody!.setAngvel(0, false);
    this._nativeBody!.setLinvel(new Vector2(0, 0), false);
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
      this.removeFromWorld({ physicsWorld: this.world } as any as Rapier2dGgWorld, true);
    }
    this.onCollisionStart$.complete();
    this.onCollisionEnd$.complete();
  }
}
