import {
  buildWheelContact,
  defaultMaxSuspensionForce,
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
 * and 10 ms steps, 0.3 m behind it. `stepVehicleController` records the chassis pose the rays were
 * cast from, and `getWheelContact`/`getWheelTransform` carry those points along with the chassis to
 * its current pose (`toCurrentPose`), so they match the chassis' position and velocities. A contact
 * point moves with the chassis' motion along the ground only: the chassis moving along the ground
 * normal (on its springs, or landing) leaves the ground where it is.
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

  /** The chassis pose of the last `updateVehicle` call, i.e. the pose its wheel rays were cast from. */
  private castPosition: Point3 | null = null;
  private castRotation: Point4 | null = null;

  /**
   * The chassis' current pose and the rotation from the cast pose to it (`sinceCast`), for
   * `toCurrentPose`. Every wheel's `getWheelTransform`/`getWheelContact` needs them, so they are
   * read from the native body once and kept until the chassis moves: cleared before every step
   * (`stepVehicleController`) and by every `position`/`rotation` write.
   */
  private currentPose: { position: Point3; rotation: Point4; sinceCast: Point4 } | null = null;

  constructor(
    protected readonly world: Rapier3dWorldComponent,
    private chassisBody: Rapier3dRigidBodyComponent,
  ) {
    super(world, ...chassisBody.factoryProps);
  }

  public get position(): Point3 {
    return super.position;
  }

  public set position(value: Point3) {
    super.position = value;
    this.currentPose = null;
  }

  public get rotation(): Point4 {
    return super.rotation;
  }

  public set rotation(value: Point4) {
    super.rotation = value;
    this.currentPose = null;
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
    this.castPosition = null;
    this.castRotation = null;
    this.currentPose = null;
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
    }
    // `updateVehicle` changes the chassis' velocities only, so this is the pose it casts from
    this.castPosition = this.position;
    this.castRotation = this.rotation;
    this.currentPose = null;
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

  isWheelTouchesGround(wheelIndex: number): boolean {
    return this.nativeVehicle?.wheelIsInContact(wheelIndex) ?? false;
  }

  /** See `currentPose`. */
  private chassisPose(): { position: Point3; rotation: Point4; sinceCast: Point4 } {
    if (!this.currentPose) {
      const rotation = this.rotation;
      this.currentPose = {
        position: this.position,
        rotation,
        sinceCast: this.castRotation ? Qtrn.mult(rotation, Qtrn.conjugate(this.castRotation)) : Qtrn.O,
      };
    }
    return this.currentPose;
  }

  /**
   * Moves a world-space point `updateVehicle` stored from the chassis pose it cast from to the
   * chassis' current pose - see this class's own doc.
   */
  private toCurrentPose(point: Point3): Point3 {
    if (!this.castPosition) {
      return point;
    }
    const pose = this.chassisPose();
    return Pnt3.add(Pnt3.rot(Pnt3.sub(point, this.castPosition), pose.sinceCast), pose.position);
  }

  /**
   * Reads the controller's contact point, normal and suspension force of the last `updateVehicle`,
   * with the point moved along the ground plane by the chassis' motion since (see this class's own
   * doc). The normal is the ground's and stays as cast. Rapier does not report how far over its
   * grip a wheel is, so `skid` is `null`.
   */
  getWheelContact(wheelIndex: number): WheelContact | null {
    const nativeVehicle = this.nativeVehicle;
    if (!nativeVehicle || wheelIndex < 0 || wheelIndex >= nativeVehicle.numWheels()) {
      return null;
    }
    const point = nativeVehicle.wheelContactPoint(wheelIndex);
    const normal = nativeVehicle.wheelContactNormal(wheelIndex);
    if (!nativeVehicle.wheelIsInContact(wheelIndex) || !point || !normal) {
      return null;
    }
    const castPoint = Pnt3.clone(point);
    const groundNormal = Pnt3.clone(normal);
    const carried = Pnt3.sub(this.toCurrentPose(castPoint), castPoint);
    return buildWheelContact({
      point: Pnt3.add(castPoint, Pnt3.sub(carried, Pnt3.scalarMult(groundNormal, Pnt3.dot(carried, groundNormal)))),
      normal: groundNormal,
      // every wheel's axle in chassis space is +X (see `addWheel`)
      steering: nativeVehicle.wheelSteering(wheelIndex) ?? 0,
      chassisRotation: this.chassisPose().rotation,
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
   * - **Position**: `wheelHardPoint` is already world-space (the ray-cast's own start point, fixed
   *   relative to the chassis), but from the pose the rays were cast from, so it is first carried to
   *   the chassis' current pose (`toCurrentPose`). Moving it `wheelSuspensionLength` further along
   *   the *world-space* suspension direction (`wheelDirectionCs` rotated by the chassis's current
   *   rotation) lands exactly on the wheel's current (compressed-by-however-much) center, airborne
   *   or grounded alike.
   * - **Rotation**: composed as chassis rotation ∘ steering (about the chassis's local up axis,
   *   `Pnt3.Z` - only ever nonzero for wheels `RaycastVehicle3dEntity` actually steers) ∘ roll (about
   *   this wheel's own configured local axle, `wheelRotation`'s accumulated spin angle). This is a
   *   best-effort reconstruction, not something read back verbatim from the native engine - document
   *   as a known limitation rather than chasing exactness, same spirit as
   *   `Rapier3dCharacterControllerComponent`'s ground-normal approximation.
   */
  getWheelTransform(wheelIndex: number): { position: Point3; rotation: Point4 } {
    if (!this.nativeVehicle) {
      return { position: Pnt3.O, rotation: Qtrn.O };
    }
    const chassisRotation = this.chassisPose().rotation;

    const hardPoint = this.nativeVehicle.wheelHardPoint(wheelIndex);
    const directionCs = this.nativeVehicle.wheelDirectionCs(wheelIndex);
    const suspensionLength = this.nativeVehicle.wheelSuspensionLength(wheelIndex) ?? 0;
    let position = Pnt3.O;
    if (hardPoint && directionCs) {
      const worldDirection = Pnt3.rot(Pnt3.clone(directionCs), chassisRotation);
      position = Pnt3.add(this.toCurrentPose(Pnt3.clone(hardPoint)), Pnt3.scalarMult(worldDirection, suspensionLength));
    }

    const axleCs = this.nativeVehicle.wheelAxleCs(wheelIndex);
    const rollAngle = this.nativeVehicle.wheelRotation(wheelIndex) ?? 0;
    const steerAngle = this.nativeVehicle.wheelSteering(wheelIndex) ?? 0;
    const rollRotation = axleCs ? Qtrn.rotAround(Qtrn.O, Pnt3.clone(axleCs), rollAngle) : Qtrn.O;
    const steerRotation = Qtrn.rotAround(Qtrn.O, Pnt3.Z, steerAngle);
    const rotation = Qtrn.combineRotations(chassisRotation, steerRotation, rollRotation);

    return { position, rotation };
  }

  resetSuspension(): void {
    // No native equivalent: Rapier doesn't expose a settable "current suspension length" (only the
    // rest length/travel bounds that shape it). Not load-bearing, either - the very next
    // `stepVehicleController` tick re-derives every wheel's suspension length from a fresh ray-cast
    // against the vehicle's (by then already reset) position, so a teleport/respawn recovers on its
    // own within one tick without this. Kept as a documented no-op purely for interface conformance,
    // same spirit as other best-effort gaps in this file.
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
