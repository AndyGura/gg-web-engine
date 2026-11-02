import {
  BitMask,
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
import { Body, Composite, Sleeping } from 'matter-js';
import { buildMatterRigidBody } from '../matter-rigid-body-builder';
import { Observable, Subject } from 'rxjs';
import { MatterGgWorld, MatterPhysicsTypeDocRepo } from '../types';
import {
  fromMatterPoint,
  MATTER_ANGULAR_VELOCITY_SCALE,
  MATTER_FORCE_SCALE,
  MATTER_INERTIA_TO_SI,
  MATTER_TORQUE_SCALE,
  MATTER_VELOCITY_SCALE,
  toMatterPoint,
} from '../matter-units';

/**
 * A rigid body backed by a matter-js `Body`. Every member of the engine's API is in meters,
 * kilograms and seconds; `nativeBody` is in matter-js's native units (see `matter-units.ts` for the
 * conversion every getter/setter here applies).
 */
export class MatterRigidBodyComponent implements IRigidBody2dComponent<MatterPhysicsTypeDocRepo> {
  private addedToWorld: boolean = false;

  public get position(): Point2 {
    return fromMatterPoint(this.nativeBody.position);
  }

  public set position(value: Point2) {
    Body.setPosition(this.nativeBody, toMatterPoint(value));
  }

  public get rotation(): number {
    return this.nativeBody.angle;
  }

  public set rotation(value: number) {
    Body.setAngle(this.nativeBody, value);
  }

  /**
   * `Body.getVelocity`/`Body.setVelocity` rather than the raw `nativeBody.velocity` field: the
   * field holds the last step's displacement (per that step's own `dt`), the accessors normalise
   * to matter's base step, so the m/s conversion holds at any frame rate.
   */
  get linearVelocity(): Point2 {
    return Pnt2.scalarMult(Body.getVelocity(this.nativeBody), 1 / MATTER_VELOCITY_SCALE);
  }

  set linearVelocity(value: Point2) {
    Body.setVelocity(this.nativeBody, Pnt2.scalarMult(value, MATTER_VELOCITY_SCALE));
  }

  /**
   * matter-js accumulates `body.force`/`body.torque` until its next `Engine.update`, which applies
   * and then clears them - `IRigidBodyComponent.applyForce`'s "next `simulate()` call only"
   * lifetime for free. `Body.applyForce` with a world point also adds the offset's torque.
   * `Engine.update` only clears the accumulators of bodies in its composite, so a body outside the
   * world ignores the call (per the contract) rather than banking every tick's force to fire at
   * once after `addToWorld`.
   *
   * The lever-arm torque of a `worldPoint` is added through `applyTorque` (in N·m, computed in
   * meters) rather than by passing the point to `Body.applyForce`: force and torque convert to
   * native units by different factors (`MATTER_FORCE_SCALE` vs `MATTER_TORQUE_SCALE`).
   */
  applyForce(force: Point2, worldPoint?: Point2): void {
    if (this.nativeBody.isStatic || !this.addedToWorld) {
      return;
    }
    Body.applyForce(this.nativeBody, this.nativeBody.position, Pnt2.scalarMult(force, MATTER_FORCE_SCALE));
    if (worldPoint) {
      const r = Pnt2.sub(worldPoint, this.position);
      this.nativeBody.torque += (r.x * force.y - r.y * force.x) * MATTER_TORQUE_SCALE;
    }
    this.wakeUp();
  }

  /** matter-js has no impulse: the velocity change `impulse / mass` is written directly. */
  applyImpulse(impulse: Point2, worldPoint?: Point2): void {
    if (this.nativeBody.isStatic || !this.addedToWorld) {
      return;
    }
    const mass = this.nativeBody.mass;
    this.linearVelocity = Pnt2.add(this.linearVelocity, Pnt2.scalarMult(impulse, 1 / mass));
    if (worldPoint) {
      const r = Pnt2.sub(worldPoint, this.position);
      this.applyTorqueImpulse(r.x * impulse.y - r.y * impulse.x);
    }
    this.wakeUp();
  }

  applyTorque(torque: number): void {
    if (this.nativeBody.isStatic || !this.addedToWorld) {
      return;
    }
    this.nativeBody.torque += torque * MATTER_TORQUE_SCALE;
    this.wakeUp();
  }

  /** The physical moment of inertia of this body, in kg·m². */
  private get inertia(): number {
    return this.nativeBody.inertia * MATTER_INERTIA_TO_SI;
  }

  /** matter-js has no impulse: the angular velocity change `torqueImpulse / inertia` (rad/s) is written directly. */
  applyTorqueImpulse(torqueImpulse: number): void {
    if (this.nativeBody.isStatic || !this.addedToWorld) {
      return;
    }
    this.angularVelocity = this.angularVelocity + torqueImpulse / this.inertia;
    this.wakeUp();
  }

  /** rad/s; see `linearVelocity` for why the accessors, not the raw field, are used. */
  get angularVelocity(): number {
    return Body.getAngularVelocity(this.nativeBody) / MATTER_ANGULAR_VELOCITY_SCALE;
  }

  set angularVelocity(value: number) {
    Body.setAngularVelocity(this.nativeBody, value * MATTER_ANGULAR_VELOCITY_SCALE);
  }

  public name: string = '';

  public entity: Entity2d | null = null;

  // matter-js has no native kinematic body - a body requested as `kinematic_pos`/`kinematic_vel`
  // is physically an ordinary `isStatic: true` body under the hood (see `MatterFactory
  // .transformOptions`'s own doc), so the debug view reports what it actually *is* (`RIGID_STATIC`)
  // rather than what an app originally asked for - the console warning at creation time is what
  // tells a developer their kinematic request wasn't honored, not this view.
  readonly debugBodySettings: DebugBody2DSettings = new DebugBody2DSettings(
    isFinite(this.nativeBody.mass)
      ? { type: 'RIGID_DYNAMIC', sleeping: () => this.isSleeping }
      : { type: 'RIGID_STATIC' },
    this.shape,
  );

  /**
   * See `IRigidBodyComponent.bodyOptions`'s own doc. `mass`/`friction`/`restitution` are read live
   * off the native matter-js body (a plain JS object - `.mass`/`.friction`/`.restitution` are
   * ordinary fields, resolved to matter-js's own defaults by `Body.create` for whichever of them
   * weren't explicitly given, so this reflects the body's *actual* resolved values, not just
   * whatever was requested). `bodyType`/`ccd` are stored as originally requested rather than
   * derived from the native body: matter-js has no kinematic body concept at all (a requested
   * `kinematic_pos`/`kinematic_vel` degrades to a plain `isStatic` body - see `MatterFactory
   * .transformOptions`'s own doc) and no CCD, so neither is recoverable from - or even meaningfully
   * "live" on - the native body itself; echoing the request instead keeps a level JSON reloaded
   * under a different, kinematic/CCD-capable adapter faithful to what was actually asked for.
   */
  get bodyOptions(): Readonly<BodyOptions> {
    return {
      bodyType: this.bodyType,
      mass: this.nativeBody.mass,
      friction: this.nativeBody.friction,
      restitution: this.nativeBody.restitution,
      ccd: this.ccd,
      canSleep: this.canSleep,
      ownCollisionGroups: this.ownCollisionGroups,
      interactWithCollisionGroups: this.interactWithCollisionGroups,
    };
  }

  protected _interactWithCGsMask = BitMask.full(16);
  protected _ownCGsMask = BitMask.full(16);

  get onCollisionStart(): Observable<CollisionEvent<Point2, MatterRigidBodyComponent>> {
    return this.onCollisionStart$.asObservable();
  }

  get onCollisionEnd(): Observable<MatterRigidBodyComponent | null> {
    return this.onCollisionEnd$.asObservable();
  }

  protected readonly onCollisionStart$: Subject<CollisionEvent<Point2, MatterRigidBodyComponent>> = new Subject<
    CollisionEvent<Point2, MatterRigidBodyComponent>
  >();
  protected readonly onCollisionEnd$: Subject<MatterRigidBodyComponent | null> =
    new Subject<MatterRigidBodyComponent | null>();

  /** Other rigid bodies this body is currently touching (non-sensor contact only), each mapped to
   * how many native part pairs of the two bodies touch right now. matter-js pairs *parts*, so a
   * `COMPOUND` body touching another on two parts gets two native `collisionStart`s, and a
   * `collisionEnd` whenever one part lets go while the other still touches. `onCollisionStart`
   * fires only when the count goes from 0 to 1 and `onCollisionEnd` only when it returns to 0: one
   * start and one end per body pair, as the contract says. Also what lets `removeFromWorld` emit
   * `onCollisionEnd(null)` on every partner per that member's documented "other body removed while
   * still in contact" case. Maintained exclusively via `notifyCollisionStart`/`notifyCollisionEnd`,
   * called by `MatterWorldComponent`'s single world-wide `collisionStart`/`collisionEnd` listener -
   * not touched directly by anything else. */
  protected readonly collidingWith: Map<MatterRigidBodyComponent, number> = new Map();

  constructor(
    public nativeBody: Body,
    public readonly shape: Shape2DDescriptor,
    public readonly bodyType: BodyType = 'dynamic',
    public readonly ccd: boolean = false,
    public readonly canSleep: boolean = true,
  ) {
    this.updateCollisionFilter();
    if (!canSleep) {
      // this adapter's engine never sleeps bodies on its own, but an app may turn on
      // `engine.enableSleeping` - an infinite threshold keeps this body awake even then
      nativeBody.sleepThreshold = Infinity;
    }
  }

  /** @internal called by `MatterWorldComponent`'s global `collisionStart` listener - not part of
   * this component's public API surface. */
  notifyCollisionStart(collisionEvent: CollisionEvent<Point2, MatterRigidBodyComponent>): void {
    if (this.trackCollisionStart(collisionEvent.otherBody)) {
      this.emitCollisionStart(collisionEvent);
    }
  }

  /**
   * First half of `notifyCollisionStart`, the bookkeeping: counts one more touching pair with
   * `otherBody` and tells whether that was the first (an `onCollisionStart` is due). The world's
   * dispatch counts both sides of a pair before it emits to either, so a subscriber of the first
   * side that removes the second finds the second's own `collidingWith` already holding the first
   * and `removeFromWorld` tells the first that the contact ended.
   */
  public trackCollisionStart(otherBody: MatterRigidBodyComponent): boolean {
    const touching = this.collidingWith.get(otherBody) ?? 0;
    this.collidingWith.set(otherBody, touching + 1);
    return touching === 0;
  }

  /** Second half of `notifyCollisionStart`: emits `onCollisionStart`, after `trackCollisionStart` said to. */
  public emitCollisionStart(event: CollisionEvent<Point2, MatterRigidBodyComponent>): void {
    this.onCollisionStart$.next(event);
  }

  /** @internal called by `MatterWorldComponent`'s global `collisionEnd` listener - not part of
   * this component's public API surface. */
  notifyCollisionEnd(otherBody: MatterRigidBodyComponent | null): void {
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
  public trackCollisionEnd(otherBody: MatterRigidBodyComponent): boolean {
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
  public emitCollisionEnd(otherBody: MatterRigidBodyComponent | null): void {
    this.onCollisionEnd$.next(otherBody);
  }

  get interactWithCollisionGroups(): ReadonlyArray<CollisionGroup> {
    return BitMask.unpack(this._interactWithCGsMask, 16);
  }

  set interactWithCollisionGroups(value: ReadonlyArray<CollisionGroup> | 'all') {
    let mask;
    if (value === 'all') {
      mask = BitMask.full(16);
    } else {
      mask = BitMask.pack(value, 16);
    }
    if (this._interactWithCGsMask !== mask) {
      this._interactWithCGsMask = mask;
      this.updateCollisionFilter();
    }
  }

  get ownCollisionGroups(): ReadonlyArray<CollisionGroup> {
    return BitMask.unpack(this._ownCGsMask, 16);
  }

  set ownCollisionGroups(value: ReadonlyArray<CollisionGroup> | 'all') {
    let mask;
    if (value === 'all') {
      mask = BitMask.full(16);
    } else {
      mask = BitMask.pack(value, 16);
    }
    if (this._ownCGsMask !== mask) {
      this._ownCGsMask = mask;
      this.updateCollisionFilter();
    }
  }

  protected updateCollisionFilter(): void {
    this.nativeBody.collisionFilter = {
      ...this.nativeBody.collisionFilter,
      category: this._ownCGsMask,
      mask: this._interactWithCGsMask,
    };
  }

  clone(): MatterRigidBodyComponent {
    // Rebuilt from the shape and options rather than `Body.create({ ...this.nativeBody })`: a native
    // body references itself (`parts[0]` and `parent` are the body itself), so matter-js's deep
    // option merge recurses forever on it.
    const { mass, ...options } = this.bodyOptions;
    return buildMatterRigidBody(
      {
        shape: this.shape,
        // a static body reports an infinite mass, which isn't a valid option to build one from
        body: this.bodyType === 'dynamic' ? { ...options, mass } : options,
      },
      { position: this.position, rotation: this.rotation },
    );
  }

  addToWorld(world: MatterGgWorld): void {
    Composite.add(world.physicsWorld.requireMatterWorld('adding bodies to the world'), this.nativeBody);
    this.addedToWorld = true;
    world.physicsWorld.added$.next(this);
  }

  removeFromWorld(world: MatterGgWorld, dispose: boolean = false): void {
    Composite.remove(world.physicsWorld.matterWorld!, this.nativeBody);
    this.addedToWorld = false;
    world.physicsWorld.removed$.next(this);
    // this body is leaving the world while still touching others - per `onCollisionEnd`'s own
    // contract, each of those bodies sees `null` (no further contact geometry is available), not a
    // dangling reference to a body no longer in the world.
    for (const other of this.collidingWith.keys()) {
      other.collidingWith.delete(this);
      other.notifyCollisionEnd(null);
    }
    this.collidingWith.clear();
    if (dispose) {
      this.dispose();
    }
  }

  // matter.js bodies are plain JS objects with no native/WASM handle - ordinary GC reclaims them
  // once `Composite.remove` above drops the engine's own reference, so there's nothing to free
  // beyond completing this component's own RxJS subjects. `MatterTriggerComponent` overrides this
  // to also complete its own `onEnter$`/`onLeft$` subjects, calling back into this via `super.
  // dispose()`.
  dispose(): void {
    this.onCollisionStart$.complete();
    this.onCollisionEnd$.complete();
  }

  resetMotion(): void {
    Body.setVelocity(this.nativeBody, Pnt2.O);
    Body.setAngularVelocity(this.nativeBody, 0);
  }

  /**
   * A `kinematic_pos`/`kinematic_vel` request also reports `isStatic: true` here - see this
   * component's own `bodyType`/`bodyOptions` doc for why matter-js can't distinguish that from a
   * genuine `'static'` body natively. Both are equally never simulated as a sleepable dynamic body,
   * so gating on the native `isStatic` flag rather than `this.bodyType === 'static'` is correct for
   * both cases, not just the literal static one.
   *
   * Also always `false` regardless of `isStatic` unless the world's underlying `Matter.Engine` was
   * created with `enableSleeping: true` - this adapter never turns that on itself (see
   * `MatterWorldComponent`'s own doc on its `matterWorld`/engine setup), so a body constructed
   * through this adapter alone never actually falls asleep on its own; `sleep()` below still forces
   * it regardless of that engine setting.
   */
  get isSleeping(): boolean {
    return !this.nativeBody.isStatic && this.nativeBody.isSleeping;
  }

  /**
   * No-op on a body that reports `isStatic` (a genuine `'static'` body, or a `kinematic_pos`/
   * `kinematic_vel` request - see `isSleeping`'s own doc for why both are treated the same here).
   */
  wakeUp(): void {
    if (this.nativeBody.isStatic) {
      return;
    }
    Sleeping.set(this.nativeBody, false);
  }

  /**
   * No-op on a body that reports `isStatic` (see `isSleeping`'s own doc) or was created with
   * `canSleep: false`. Forces sleep immediately,
   * regardless of whether the world's `Matter.Engine` has `enableSleeping` turned on - unlike a
   * body naturally falling asleep from inactivity (which requires that engine flag), an explicit
   * `Sleeping.set(body, true)` call takes effect either way.
   */
  sleep(): void {
    if (this.nativeBody.isStatic || !this.canSleep) {
      return;
    }
    Sleeping.set(this.nativeBody, true);
  }
}
