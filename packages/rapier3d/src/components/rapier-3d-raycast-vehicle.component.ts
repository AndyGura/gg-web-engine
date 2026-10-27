import {
  buildWheelContact,
  defaultMaxSuspensionForce,
  Frame3d,
  IRaycastVehicleComponent,
  Pnt3,
  Point3,
  Point4,
  Qtrn,
  SuspensionOptions,
  WheelContact,
  WheelOptions,
} from '@gg-web-engine/core';
import { DynamicRayCastVehicleController, QueryFilterFlags, Vector } from '@dimforge/rapier3d-compat';
import { Rapier3dRigidBodyComponent } from './rapier-3d-rigid-body.component';
import { Rapier3dWorldComponent } from './rapier-3d-world.component';
import { Rapier3dGgWorld, Rapier3dPhysicsTypeDocRepo } from '../types';

type WheelEntry = {
  connectionPointCs: Vector;
  directionCs: Vector;
  axleCs: Vector;
  restLength: number;
  radius: number;
  options: WheelOptions;
  suspension: SuspensionOptions;
  /** Newtons - see `Rapier3dRaycastVehicleComponent.applyBrake()` */
  brakeForce: number;
  /** Radians, as last set (`setSteering`), and as the last `updateVehicle` used it. */
  steering: number;
  stepSteering: number;
};

/**
 * Rapier's `DynamicRayCastVehicleController` (`world.createVehicleController`) is a thin wrapper
 * around wheel raycasting only - nothing steps it automatically as part of `World.step()`.
 * Instead, `updateVehicle(dt, ...)` must be called once per tick *before* `world.step()` - it directly writes the chassis's own
 * `linvel`/`angvel` from that tick's suspension/engine/brake forces, which `world.step()` then
 * integrates like any other dynamic body's velocity. This component registers itself into
 * `Rapier3dWorldComponent.raycastVehicles` on `addToWorld`/`removeFromWorld` so the world component
 * can drive that call centrally from `simulate()` - see that class's doc.
 *
 * Because the rays are cast before the step, everything `updateVehicle` stores in world space (each
 * wheel's hard point and contact point) is where the chassis *was* before the last step: at 30 m/s
 * and 10 ms steps, 0.3 m behind it. `getWheelTransform`/`getWheelContact` therefore never use the
 * stored hard point: they place each wheel's ray from the chassis' current pose
 * (`currentWheelRay`), so the wheel and its contact match the chassis' position and velocities.
 * The ground stays where it is: a contact point is where the wheel's current ray meets the ground
 * plane the cast found, so the chassis moving along the ground normal (on its springs, or landing)
 * leaves it on the ground.
 *
 * Like `Rapier3dCharacterControllerComponent`/`Rapier3dTriggerComponent`, this class and
 * `Rapier3dWorldComponent` import each other (the world needs this class purely as a type for its
 * `raycastVehicles` set, the vehicle needs the world's concrete type for its constructor/`addToWorld`
 * parameter) - this circular import is an established, safe pattern in this package (see those two
 * classes), not specific to this one.
 */
export class Rapier3dRaycastVehicleComponent
  extends Rapier3dRigidBodyComponent
  implements IRaycastVehicleComponent<Rapier3dPhysicsTypeDocRepo>
{
  protected _nativeVehicle: DynamicRayCastVehicleController | null = null;

  public get nativeVehicle(): DynamicRayCastVehicleController | null {
    return this._nativeVehicle;
  }

  private readonly wheels: WheelEntry[] = [];

  /**
   * Set by `resetSuspension()` until the next `updateVehicle`: the contacts and suspension lengths
   * of the last cast belong to where the chassis was before the reset (a teleport), so the wheels
   * report no ground and hang at their rest length.
   */
  private wheelContactsReset = false;

  /**
   * The frame switches (`Gg3dWorld.switchFrame`) since the last `updateVehicle`, composed: the
   * controller's world-space contact data (`wheelContactPoint`/`wheelContactNormal`/
   * `wheelHardPoint`) stays in the frame it was cast in, so `getWheelContact` carries it through
   * this until the next cast replaces it. `null` when nothing switched.
   */
  private castFrameDelta: Frame3d | null = null;

  constructor(
    protected readonly world: Rapier3dWorldComponent,
    private chassisBody: Rapier3dRigidBodyComponent,
  ) {
    super(world, ...chassisBody.factoryProps);
  }

  get wheelSpeed(): number {
    return this.nativeVehicle?.currentVehicleSpeed() || 0;
  }

  addToWorld(world: Rapier3dGgWorld) {
    super.addToWorld(world);
    const nativeWorld = this.world.nativeWorld;
    this._nativeVehicle = nativeWorld.createVehicleController(this._nativeBody!);
    // matches this engine's own Z-up/Y-forward convention (see `RaycastVehicle3dEntity`'s own doc:
    // "car mesh and physics body direction has to be pointing: y front, z up") - axis indices are
    // 0 = x, 1 = y, 2 = z.
    this._nativeVehicle.indexUpAxis = 2;
    // this pinned `@dimforge/rapier3d-compat` build's own setter is genuinely named
    // `setIndexForwardAxis` (a setter *property*, not a typo introduced by this adapter) - see
    // `ray_cast_vehicle_controller.d.ts`'s `set setIndexForwardAxis(axis: number)`.
    this._nativeVehicle.setIndexForwardAxis = 1;
    for (const wheel of this.wheels) {
      this.attachWheel(this._nativeVehicle, wheel);
    }
    this.world.raycastVehicles.add(this);
  }

  removeFromWorld(world: Rapier3dGgWorld, dispose?: boolean) {
    if (world.physicsWorld != this.world) {
      throw new Error(
        "Rapier3D bodies cannot be shared between different worlds: this one was created by another world's factory. " +
          'Create it with the factory of the world it is added to (`world.physicsWorld.factory`).',
      );
    }
    this.world.raycastVehicles.delete(this);
    if (this._nativeVehicle) {
      this.world.nativeWorld.removeVehicleController(this._nativeVehicle);
      // `removeVehicleController` only unregisters it from the world's own bookkeeping - the JS
      // wrapper's own native handle still needs an explicit `.free()`, which nothing else ever
      // reaches (see this class's own doc and `gg-engine-physics-adapter-rapier`). Always freed here
      // (not gated behind `dispose`, mirroring `Rapier3dRigidBodyComponent.removeFromWorld`'s own
      // unconditional native cleanup - a vehicle controller isn't reconstructible from a stored
      // descriptor the way a rigid body is, so keeping a stale, removed-but-unfreed reference around
      // for a possible future re-`addToWorld` would only leak it, never usefully resurrect it).
      this._nativeVehicle.free();
      this._nativeVehicle = null;
    }
    this.wheelContactsReset = false;
    super.removeFromWorld(world, dispose);
  }

  /**
   * Called once per `simulate()` tick by `Rapier3dWorldComponent`, *before* `World.step()` - see
   * this class's own doc for why. `filterGroups` threads this vehicle's own collision groups
   * (`this.collisionGroups`, inherited from `Rapier3dRigidBodyComponent` and already packed in the
   * `InteractionGroups` layout Rapier expects) into the wheels' own suspension raycasts, so a
   * vehicle in one collision group doesn't get held up by suspension force from a floor it isn't
   * meant to interact with - without this, only the chassis's own broadphase collision would
   * respect collision groups, not the ray-cast-based wheel/ground detection (see
   * `gg-engine-physics-adapter`'s testing guidance on this). `EXCLUDE_SENSORS` keeps a `Trigger`'s
   * sensor volume from ever acting as solid ground for a wheel, mirroring
   * `Rapier3dCharacterControllerComponent.move()`'s identical guard.
   */
  public stepVehicleController(dt: number): void {
    if (!this._nativeVehicle) {
      return;
    }
    // Rapier's brake is "the maximum amount of braking impulse" of one `updateVehicle` call (the
    // controller is a port of Bullet's raycast vehicle), and that runs once per tick: an
    // unconverted force braked in proportion to the frame rate (0.16 / 0.32 / 0.76 g at 30 / 60 /
    // 144 FPS for the same value). The impulse of a force over this tick is force × dt.
    for (let i = 0; i < this.wheels.length; i++) {
      this._nativeVehicle.setWheelBrake(i, this.wheels[i].brakeForce * dt);
      this.wheels[i].stepSteering = this.wheels[i].steering;
    }
    this.wheelContactsReset = false;
    this.castFrameDelta = null;
    this._nativeVehicle.updateVehicle(dt, QueryFilterFlags.EXCLUDE_SENSORS, this.collisionGroups);
  }

  private attachWheel(nativeVehicle: DynamicRayCastVehicleController, wheel: WheelEntry): void {
    nativeVehicle.addWheel(wheel.connectionPointCs, wheel.directionCs, wheel.axleCs, wheel.restLength, wheel.radius);
    const i = nativeVehicle.numWheels() - 1;
    nativeVehicle.setWheelSuspensionStiffness(i, wheel.suspension.stiffness);
    nativeVehicle.setWheelSuspensionRelaxation(i, wheel.suspension.damping);
    nativeVehicle.setWheelSuspensionCompression(i, wheel.suspension.compression);
    nativeVehicle.setWheelMaxSuspensionTravel(i, wheel.options.maxTravel);
    nativeVehicle.setWheelMaxSuspensionForce(
      i,
      wheel.options.maxSuspensionForce ?? defaultMaxSuspensionForce(this.bodyOptions.mass),
    );
    nativeVehicle.setWheelFrictionSlip(i, wheel.options.frictionSlip);
    // Rapier's vehicle controller has no roll influence, so `WheelOptions.rollInfluence` is ignored
    // here (see its doc); side grip is its own option.
    nativeVehicle.setWheelSideFrictionStiffness(i, wheel.options.sideFrictionStiffness ?? 1);
    nativeVehicle.setWheelSteering(i, wheel.steering);
  }

  addWheel(options: WheelOptions, suspensionOptions: SuspensionOptions): void {
    const wheel: WheelEntry = {
      connectionPointCs: Pnt3.clone(options.position),
      directionCs: Pnt3.nZ,
      // One constant axle for every wheel, left or right. Confirmed empirically that flipping this
      // per side (an earlier version of this method used `options.isLeft ? Pnt3.X : Pnt3.nX`, on the
      // theory that it would make `getWheelTransform`'s roll rotation spin each side's mesh the
      // visually correct way) breaks *driving* outright: Rapier's engine-force/friction model treats
      // `axleCs` as the wheel's forward-tire-direction reference, so a flipped axle on one side
      // applies that side's engine force in the opposite world direction from the other side - equal
      // and opposite forward forces exactly cancel, and the chassis never moves (a real regression
      // test - drive under engine force and assert net displacement - is what caught this; a
      // settle-only test cannot, since it never applies engine force at all). Left/right visual
      // mirroring of the wheel mesh is already handled adapter-agnostically at the entity level
      // (`RaycastVehicle3dEntity`'s own `wheelLocalRotation`, derived from `WheelOptions.isLeft`), so
      // `getWheelTransform` below doesn't need to (and must not) compensate for it again itself.
      axleCs: Pnt3.X,
      restLength: suspensionOptions.restLength,
      radius: options.tyreRadius,
      options,
      suspension: suspensionOptions,
      brakeForce: 0,
      steering: 0,
      stepSteering: 0,
    };
    this.wheels.push(wheel);
    if (this._nativeVehicle) {
      this.attachWheel(this._nativeVehicle, wheel);
    }
  }

  setWheelFrictionSlip(wheelIndex: number, frictionSlip: number): void {
    const wheel = this.wheels[wheelIndex];
    if (!wheel) {
      return;
    }
    // kept on the entry too, so a re-add (`attachWheel`) rebuilds the wheel with the live value
    wheel.options = { ...wheel.options, frictionSlip };
    this.nativeVehicle?.setWheelFrictionSlip(wheelIndex, frictionSlip);
  }

  getWheelFrictionSlip(wheelIndex: number): number {
    return this.nativeVehicle?.wheelFrictionSlip(wheelIndex) ?? this.wheels[wheelIndex]?.options.frictionSlip ?? 0;
  }

  setSteering(wheelIndex: number, steering: number): void {
    const wheel = this.wheels[wheelIndex];
    if (!wheel) {
      return;
    }
    // kept on the entry too, for `getWheelContact` (see `stepSteering`) and a re-add (`attachWheel`)
    wheel.steering = steering;
    this.nativeVehicle?.setWheelSteering(wheelIndex, steering);
  }

  applyEngineForce(wheelIndex: number, force: number): void {
    this.nativeVehicle?.setWheelEngineForce(wheelIndex, force);
  }

  /** Stores the brake force (Newtons); `stepVehicleController()` converts it into Rapier's per-tick brake impulse. */
  applyBrake(wheelIndex: number, force: number): void {
    const wheel = this.wheels[wheelIndex];
    if (wheel) {
      wheel.brakeForce = force;
    }
  }

  /** `false` from a `resetSuspension()` until the next step, as on removal. */
  isWheelTouchesGround(wheelIndex: number): boolean {
    return !this.wheelContactsReset && (this.nativeVehicle?.wheelIsInContact(wheelIndex) ?? false);
  }

  /**
   * The wheel's ray as the chassis holds it now: its hard point (`chassis.position() *
   * connectionPointCs`, as `updateVehicle` computes it) and world-space direction, plus the chassis
   * rotation. Read from the native body on every call, so any pose write, through the
   * `position`/`rotation` setters or `nativeBody` itself, shows at once.
   */
  private currentWheelRay(wheel: WheelEntry): { hardPoint: Point3; direction: Point3; chassisRotation: Point4 } {
    const chassisRotation = this.rotation;
    return {
      hardPoint: Pnt3.add(this.position, Pnt3.rot(Pnt3.clone(wheel.connectionPointCs), chassisRotation)),
      direction: Pnt3.rot(Pnt3.clone(wheel.directionCs), chassisRotation),
      chassisRotation,
    };
  }

  /**
   * Reads the controller's contact point, normal and suspension force of the last `updateVehicle`,
   * and the steering it used (`stepSteering`). The point is where the wheel's current ray
   * (`currentWheelRay`) meets the ground plane through the cast contact (see this class's own doc).
   * The normal is the ground's and stays as cast. Rapier does not report how far over its grip a
   * wheel is, so `skid` is `null`.
   */
  getWheelContact(wheelIndex: number): WheelContact | null {
    const nativeVehicle = this.nativeVehicle;
    const wheel = this.wheels[wheelIndex];
    if (!nativeVehicle || !wheel || wheelIndex >= nativeVehicle.numWheels() || !this.isWheelTouchesGround(wheelIndex)) {
      return null;
    }
    const point = nativeVehicle.wheelContactPoint(wheelIndex);
    const normal = nativeVehicle.wheelContactNormal(wheelIndex);
    const castHardPoint = nativeVehicle.wheelHardPoint(wheelIndex);
    if (!point || !normal || !castHardPoint) {
      return null;
    }
    const castDelta = this.castFrameDelta;
    const castPoint = castDelta ? castDelta.toGlobalPoint(point) : Pnt3.clone(point);
    const groundNormal = castDelta ? castDelta.toGlobalDirection(normal) : Pnt3.clone(normal);
    const castFrom = castDelta ? castDelta.toGlobalPoint(castHardPoint) : castHardPoint;
    const ray = this.currentWheelRay(wheel);
    // the cast contact's distance along the ray, from the current hard point: the contact carried
    // with the chassis, on the wheel's current ray
    const carried = Pnt3.add(ray.hardPoint, Pnt3.scalarMult(ray.direction, Pnt3.dist(castPoint, castFrom)));
    // slide it along that ray back onto the ground plane (along the normal instead for a ray nearly
    // parallel to the ground, which would otherwise meet the plane far away)
    const offGround = Pnt3.dot(Pnt3.sub(carried, castPoint), groundNormal);
    const rayAlongNormal = Pnt3.dot(ray.direction, groundNormal);
    const onGround =
      Math.abs(rayAlongNormal) > 0.1
        ? Pnt3.sub(carried, Pnt3.scalarMult(ray.direction, offGround / rayAlongNormal))
        : Pnt3.sub(carried, Pnt3.scalarMult(groundNormal, offGround));
    return buildWheelContact({
      point: onGround,
      normal: groundNormal,
      // every wheel's axle in chassis space is +X (see `addWheel`)
      steering: wheel.stepSteering,
      chassisRotation: ray.chassisRotation,
      linearVelocity: this.linearVelocity,
      angularVelocity: this.angularVelocity,
      centerOfMass: Pnt3.clone(this._nativeBody!.worldCom()),
      suspensionForce: nativeVehicle.wheelSuspensionForce(wheelIndex) ?? 0,
      maxSuspensionForce: nativeVehicle.wheelMaxSuspensionForce(wheelIndex) ?? Infinity,
      skid: null,
    });
  }

  /**
   * Rapier's controller exposes no single call that bakes suspension travel, steering and roll into
   * one transform for rendering - only the individual pieces
   * (`wheelHardPoint`/`wheelSuspensionLength`/`wheelDirectionCs`/`wheelAxleCs`/`wheelSteering`/
   * `wheelRotation`), which this method composes by hand:
   * - **Position**: the wheel's hard point and world-space suspension direction at the chassis'
   *   current pose (`currentWheelRay` - `wheelHardPoint` is from the pose the rays were cast from).
   *   Moving `wheelSuspensionLength` along the direction from the hard point lands exactly on the
   *   wheel's current (compressed-by-however-much) center, airborne or grounded alike. After a
   *   `resetSuspension()` the rest length stands in until the next cast.
   * - **Rotation**: composed as chassis rotation ∘ steering (about the chassis's local up axis,
   *   `Pnt3.Z` - only ever nonzero for wheels `RaycastVehicle3dEntity` actually steers) ∘ roll (about
   *   this wheel's own configured local axle, `wheelRotation`'s accumulated spin angle). This is a
   *   best-effort reconstruction, not something read back verbatim from the native engine - document
   *   as a known limitation rather than chasing exactness, same spirit as
   *   `Rapier3dCharacterControllerComponent`'s ground-normal approximation.
   */
  getWheelTransform(wheelIndex: number): { position: Point3; rotation: Point4 } {
    const wheel = this.wheels[wheelIndex];
    if (!this.nativeVehicle || !wheel) {
      return { position: Pnt3.O, rotation: Qtrn.O };
    }
    const ray = this.currentWheelRay(wheel);
    const suspensionLength = this.wheelContactsReset
      ? wheel.restLength
      : (this.nativeVehicle.wheelSuspensionLength(wheelIndex) ?? wheel.restLength);
    const position = Pnt3.add(ray.hardPoint, Pnt3.scalarMult(ray.direction, suspensionLength));

    const rollAngle = this.nativeVehicle.wheelRotation(wheelIndex) ?? 0;
    const steerAngle = this.nativeVehicle.wheelSteering(wheelIndex) ?? 0;
    const rollRotation = Qtrn.rotAround(Qtrn.O, Pnt3.clone(wheel.axleCs), rollAngle);
    const steerRotation = Qtrn.rotAround(Qtrn.O, Pnt3.Z, steerAngle);
    const rotation = Qtrn.combineRotations(ray.chassisRotation, steerRotation, rollRotation);

    return { position, rotation };
  }

  /**
   * Rapier doesn't expose a settable "current suspension length" (only the rest length/travel
   * bounds that shape it); the next `stepVehicleController` re-derives every wheel's suspension
   * length from a fresh ray-cast against the vehicle's (by then already reset) position. Until that
   * step (`wheelContactsReset`) the wheels report no contact - carried to the new pose, the old ones
   * would report the old ground's plane under it - and `getWheelTransform` hangs them at their rest
   * length instead of the old cast's.
   */
  resetSuspension(): void {
    this.wheelContactsReset = true;
  }

  /**
   * Frame switch (`Gg3dWorld.switchFrame`): moves the chassis like any rigid body. The controller's
   * suspension lengths, wheel spin, steering and engine/brake settings are frame-independent and
   * stay; its world-space contact data is carried through `castFrameDelta` until the next cast.
   * `getWheelTransform` places the wheels from the chassis' current pose, so they follow at once.
   */
  onFrameSwitch(delta: Frame3d): void {
    super.onFrameSwitch(delta);
    this.castFrameDelta = this.castFrameDelta ? delta.compose(this.castFrameDelta) : delta;
  }

  public clone(): Rapier3dRaycastVehicleComponent {
    const comp = new Rapier3dRaycastVehicleComponent(this.world, this.chassisBody.clone());
    for (const wheel of this.wheels) {
      comp.addWheel(wheel.options, wheel.suspension);
    }
    return comp;
  }

  resetMotion() {
    this.resetSuspension();
    super.resetMotion();
  }
}
