import { RaycastVehicle3dEntity, RVEntityProperties, WheelDisplayOptions } from '../raycast-vehicle-3d.entity';
import { Gg3dWorld, Gg3dWorldTypeDocRepo } from '../../gg-3d-world';
import { IRenderable3dEntity } from '../i-renderable-3d.entity';
import { IPositionable3d } from '../../interfaces/i-positionable-3d';
import {
  AxisDirection3,
  cubicSplineInterpolation,
  INetworkInputDriven,
  INetworkSyncable,
  ISerializableEntity,
  CorrectionOutcome,
  NetworkApplyContext,
  Pnt3,
  Point3,
  Point4,
  RigidBodyCorrection,
  RigidBodyNetState,
  TickOrder,
} from '../../../base';
import { BehaviorSubject, Observable, takeUntil } from 'rxjs';
import { DisplayObject3dOpts } from '../../factories';
import { isMaterialReadable3d } from '../../components/rendering/i-material-readable-3d.component';

export type GgCarProperties = RVEntityProperties & {
  mpsToRpmFactor?: number;
  engine: {
    minRpm: number;
    maxRpm: number;
    torques: {
      rpm: number;
      torque: number;
    }[];
    maxRpmIncreasePerSecond: number;
    maxRpmDecreasePerSecond: number;
    /**
     * Rev limiter. Whenever the wheels would spin the engine past `maxRpm` the throttle is cut, and
     * this braking force (Newtons, for the whole car - see `GgCarEntity.tractionForce` for how a
     * car's drive force is split over its driven wheels) holds the car back, against its direction
     * of travel. Default {@link DEFAULT_OVER_REV_BRAKE_FORCE}. `0` makes the limiter a plain
     * throttle cut: above redline the car coasts under ordinary engine braking instead.
     */
    overRevBrakeForce?: number;
    /**
     * Engine braking as an engine torque: N·m per 1000 rpm the engine turns above `minRpm`, with
     * the throttle released, multiplied through the drivetrain (gear ratio, final drive,
     * efficiencies, wheel radius) exactly like the drive torque - so a low gear brakes harder than
     * a high one at the same speed, as in a real car. Replaces {@link brakingForcePerRpm} when set.
     */
    brakingTorquePer1000Rpm?: number;
    /**
     * Engine braking as a force at the wheels: Newtons per rpm of difference between `minRpm` and
     * the rpm the wheels would spin the engine at, for the whole car, with the throttle released.
     * Independent of the gear ratio, and below idle it turns into a push (an automatic's creep).
     * Default {@link DEFAULT_BRAKING_FORCE_PER_RPM}; ignored when `brakingTorquePer1000Rpm` is set.
     */
    brakingForcePerRpm?: number;
  };
  /**
   * Brake forces, in Newtons per wheel (see `IRaycastVehicleComponent.applyBrake`): the pedal
   * (`GgCarEntity.brake`, 0..1) scales `frontAxleForce` on each front wheel and `rearAxleForce` on
   * each rear wheel, the handbrake applies `handbrakeForce` to each rear wheel. Until tyre grip
   * runs out, the car decelerates by the sum of all wheels' forces divided by its mass, e.g. 1 g
   * with a 60% front share for a car of mass `m`: `frontAxleForce = 0.6 * m * 9.82 / 2`,
   * `rearAxleForce = 0.4 * m * 9.82 / 2`.
   */
  brake: {
    frontAxleForce: number;
    rearAxleForce: number;
    handbrakeForce: number;
  };
  transmission: {
    isAuto: boolean;
    reverseGearRatio: number;
    gearRatios: number[];
    drivelineEfficiency: number;
    finalDriveRatio: number; // differential
    /**
     * Per forward gear, the engine rpm at which an automatic transmission shifts up out of that
     * gear (`upShifts[0]` leaves 1st gear). It also shifts down whenever the lower gear would turn
     * the engine no faster than that gear's own `upShifts` entry, less `downshiftMargin`.
     */
    upShifts: number[];
    /**
     * Rpm of hysteresis for an automatic's downshifts (default `0`): the lower gear is only
     * selected while the engine would turn at most `upShifts[lower] - downshiftMargin` in it.
     * Without a margin a car that has just shifted up, then slows a little, shifts straight back.
     */
    downshiftMargin?: number;
    /**
     * How long a gear change takes, in milliseconds of world time (default `0`, instant). While
     * a shift is in progress (`GgCarEntity.isShifting`) the engine is disconnected: no drive force
     * and no engine braking reach the wheels, the throttle doesn't rev the engine, and an
     * automatic doesn't reconsider its gear. Every change of `gear` to a gear other than neutral
     * starts a shift, manual and automatic alike.
     */
    shiftTime?: number;
    /**
     * Efficiency of each forward gear (`gearEfficiencies[0]` for 1st), a multiplier on the drive
     * torque on top of `drivelineEfficiency`. Missing entries (and reverse) count as `1`.
     */
    gearEfficiencies?: number[];
    autoHold: boolean;
  };
  /**
   * Air drag, `½ · ρ · Cd · A · v²` against the chassis' velocity, applied through
   * `IRigidBodyComponent.applyForce` every tick, on the ground and in the air. Without it a car
   * is only ever held back by engine braking and the rev limiter, so its top speed is the redline
   * in top gear. `airDensity` (ρ) defaults to 1.225 kg/m³ (sea level); `dragCoefficient` (Cd) is
   * about 0.25-0.35 for a modern road car, `frontalArea` (A) about 2-2.5 m².
   */
  aerodynamics?: {
    dragCoefficient: number;
    frontalArea: number;
    airDensity?: number;
  };
  /**
   * Rolling resistance coefficient (about 0.01-0.015 for car tyres on asphalt): a force of
   * `rollingResistance · m · g` against the chassis' motion whenever the wheels touch the ground,
   * never more than what stops the car within the tick. Applied through
   * `IRigidBodyComponent.applyForce`. Default `0`.
   */
  rollingResistance?: number;
  /**
   * Max steering lock, in radians, applied at `steeringFactor` of ±1.
   *
   * - A plain `number` applies that angle at every speed (the original, unconditional behavior).
   * - An array of `{ atSpeedMs, angleRad }` breakpoints (speed in m/s, angle in radians) instead
   *   scales the max angle down as the car speeds up - full lock-to-lock steering at parking-lot
   *   speed will otherwise demand more lateral slip than a raycast vehicle's simplified friction
   *   model (`frictionSlip * wheelLoad`) can supply, causing the car to snap/spin rather than
   *   understeer. Breakpoints must be sorted ascending by `atSpeedMs`; the effective angle is
   *   linearly interpolated between the two straddling the current `|getSpeed()|`, clamped to the
   *   first entry's `angleRad` below the lowest speed and the last entry's `angleRad` at/above the
   *   highest. A validated shape for this: full angle below 5 m/s, linearly tapering to 30% of
   *   that by 30 m/s, flat beyond - e.g.
   *   `[{ atSpeedMs: 5, angleRad: 0.2 }, { atSpeedMs: 30, angleRad: 0.06 }]`.
   */
  maxSteerAngle: number | { atSpeedMs: number; angleRad: number }[];
};

/**
 * Networked state of a `GgCarEntity`: the chassis rigid-body snapshot plus its driving state, which
 * a replica adopts only while no remote input drives it (a Free car keeps its owner's controls).
 * Engine RPM is deliberately absent - it's derived locally from speed and gear on every peer.
 */
export type GgCarNetState = RigidBodyNetState<Point3, Point4> & {
  gear: number;
  /** Milliseconds left of a gear change in progress (`GgCarEntity.isShifting`), `0` when none. */
  shiftMs: number;
  steering: number;
  accel: number;
  brake: number;
  handBrake: boolean;
};

/** Input a possessing peer forwards for a `GgCarEntity` - see `INetworkInputDriven`. */
export interface GgCarInput {
  steeringFactor: number;
  acceleration: number;
  brake: number;
  gear: number;
  handBrake: boolean;
}

/** How often (ms of world time) an automatic transmission reconsiders its gear. */
const AUTO_SHIFT_INTERVAL = 50;

/** Default `GgCarProperties.engine.overRevBrakeForce`: 24 000 N for the whole car. */
export const DEFAULT_OVER_REV_BRAKE_FORCE = 24000;

/** Default `GgCarProperties.engine.brakingForcePerRpm`: 1 N per rpm, for the whole car. */
export const DEFAULT_BRAKING_FORCE_PER_RPM = 1;

/** Default `GgCarProperties.aerodynamics.airDensity`, kg/m³ at sea level. */
export const DEFAULT_AIR_DENSITY = 1.225;

/** Below this speed (m/s) `autoHold` holds the car with the brakes - see `GgCarProperties.transmission.autoHold`. */
const AUTO_HOLD_SPEED_THRESHOLD = 3;

/**
 * A drivable car: a `RaycastVehicle3dEntity` plus an engine with a torque curve, a gearbox (manual
 * or automatic), brakes, a handbrake and speed-dependent steering, all set by `GgCarProperties`.
 * Drive it by setting `acceleration`/`brake` (0..1), `steeringFactor` (-1..1), `handBrake` and
 * `gear` - from code, or with a `GgCarHandlingController` for the keyboard. Build one with the
 * `"GgCar"` level class (box chassis, primitive wheels) or with the constructor from a loaded model.
 * The wheel physics is the physics adapter's own raycast vehicle, so the same properties drive
 * differently on each backend: tune the car on the one you ship.
 *
 * @example
 * ```ts
 * import { GgCarEntity } from '@gg-web-engine/core';
 *
 * // a level whose entities include { "class": "GgCar", "name": "Car", ... }
 * const level = await world.loader.loadLevel(levelJson, 'Level');
 * const car = level.getChildEntityByName<GgCarEntity>('Car');
 *
 * // drive it from code, e.g. an AI driver
 * car.gear = 1;
 * car.acceleration = 1; // full throttle
 * car.steeringFactor = -0.3; // a gentle left turn
 * car.gear$.subscribe(gear => console.log('gear', gear));
 * world.createClock(true).tick$.subscribe(() => {
 *   const kmh = car.raycastVehicle.getSpeed() * 3.6;
 *   if (kmh > 80) car.acceleration = 0;
 * });
 * ```
 */
export class GgCarEntity<
  TypeDoc extends Gg3dWorldTypeDocRepo = Gg3dWorldTypeDocRepo,
  RVEntity extends RaycastVehicle3dEntity<TypeDoc> = RaycastVehicle3dEntity<TypeDoc>,
>
  extends IRenderable3dEntity<TypeDoc>
  implements IPositionable3d, ISerializableEntity, INetworkSyncable<GgCarNetState>, INetworkInputDriven<GgCarInput>
{
  static readonly entityTypeName: string = 'GgCarEntity';
  public readonly tickOrder = TickOrder.PHYSICS_SIMULATION - 5;

  get position(): Point3 {
    return this.raycastVehicle.position;
  }

  set position(value: Point3) {
    this.raycastVehicle.position = value;
  }

  get rotation(): Point4 {
    return this.raycastVehicle.rotation;
  }

  set rotation(value: Point4) {
    this.raycastVehicle.rotation = value;
  }

  protected get engineTorque(): number {
    const currentRPM = this.engineRpm;
    const torques = this.carProperties.engine.torques;

    if (currentRPM <= torques[0].rpm) {
      return torques[0].torque;
    } else if (currentRPM >= torques[torques.length - 1].rpm) {
      return torques[torques.length - 1].torque;
    }

    let index = 0;
    while (currentRPM > torques[index + 1].rpm) {
      index++;
    }
    const x0 = torques[index].rpm;
    const x1 = torques[index + 1].rpm;
    const y0 = torques[index].torque;
    const y1 = torques[index + 1].torque;

    const m0 = index === 0 ? 0 : (y1 - torques[index - 1].torque) / (x1 - torques[index - 1].rpm);
    const m1 = index === torques.length - 2 ? 0 : (torques[index + 2].torque - y0) / (torques[index + 2].rpm - x0);

    return cubicSplineInterpolation(currentRPM, x0, x1, y0, y1, m0, m1);
  }

  public get transmissionGearRatio(): number {
    if (this._gear == -1) {
      return this.carProperties.transmission.reverseGearRatio;
    }
    return this.carProperties.transmission.gearRatios[this._gear - 1] || 0;
  }

  protected get mpsToRpm(): number {
    return (
      this.carProperties.mpsToRpmFactor ||
      (30 * this.carProperties.transmission.finalDriveRatio) / (Math.PI * this.raycastVehicle.tractionWheelRadius)
    );
  }

  public calculateRpmFromCarSpeed(): number {
    return this.raycastVehicle.getSpeed() * this.mpsToRpm * this.transmissionGearRatio;
  }

  protected readonly _rpm$: BehaviorSubject<number> = new BehaviorSubject<number>(this.carProperties.engine.minRpm);

  public get engineRpm$(): Observable<number> {
    return this._rpm$.asObservable();
  }

  public get engineRpm(): number {
    return this._rpm$.getValue();
  }

  /**
   * Multiplier of the current gear's own efficiency (`transmission.gearEfficiencies`), `1` for
   * reverse, neutral or a gear without an entry.
   */
  protected get gearEfficiency(): number {
    return this._gear > 0 ? (this.carProperties.transmission.gearEfficiencies?.[this._gear - 1] ?? 1) : 1;
  }

  /** `transmissionGearRatio × finalDriveRatio × drivelineEfficiency × gearEfficiency / tractionWheelRadius`: engine torque (N·m) to a force at the wheels (N). */
  protected get drivetrainForcePerTorque(): number {
    return (
      (this.transmissionGearRatio *
        this.carProperties.transmission.finalDriveRatio *
        this.carProperties.transmission.drivelineEfficiency *
        this.gearEfficiency) /
      this.raycastVehicle.tractionWheelRadius
    );
  }

  /**
   * The drive force at full throttle, in Newtons, for the whole car: the engine's torque at the
   * current rpm through the current gear, the final drive, the efficiencies and the wheel radius.
   * `applyDrive` splits it between the axles by `tractionBias` and then equally over each axle's
   * wheels, so the car as a whole is pushed by exactly this force whatever its number of wheels.
   */
  protected get tractionForce(): number {
    return this.engineTorque * this.drivetrainForcePerTorque;
  }

  /**
   * The force at the wheels, in Newtons for the whole car and signed along the car's forward
   * axis, from the engine being turned by the wheels with the throttle released, at the rpm
   * `calculatedRpm` the wheels would spin it at - negative in a forward gear while above idle. See
   * `GgCarProperties.engine.brakingTorquePer1000Rpm`/`brakingForcePerRpm` for the two models.
   */
  protected engineBrakingForce(calculatedRpm: number): number {
    const engine = this.carProperties.engine;
    if (engine.brakingTorquePer1000Rpm !== undefined) {
      const torque = (engine.brakingTorquePer1000Rpm * Math.max(0, calculatedRpm - engine.minRpm)) / 1000;
      return -torque * this.drivetrainForcePerTorque;
    }
    return (
      (engine.brakingForcePerRpm ?? DEFAULT_BRAKING_FORCE_PER_RPM) *
      (engine.minRpm - calculatedRpm) *
      (this.gear > 0 ? 1 : -1)
    );
  }

  private _tailLightsOn: boolean = false;
  public get tailLightsOn(): boolean {
    return this._tailLightsOn;
  }

  protected setTailLightsOn(value: boolean) {
    if (this._tailLightsOn != value) {
      this._tailLightsOn = value;
    }
  }

  // 0..1
  protected _acceleration$: BehaviorSubject<number> = new BehaviorSubject(0);

  public get acceleration(): number {
    return this._acceleration$.getValue();
  }

  public get acceleration$(): Observable<number> {
    return this._acceleration$.asObservable();
  }

  public set acceleration(value: number) {
    this._acceleration$.next(value);
  }

  // 0..1
  protected _brake$: BehaviorSubject<number> = new BehaviorSubject(0);

  public get brake(): number {
    return this._brake$.getValue();
  }

  public set brake(value: number) {
    this._brake$.next(value);
    this.setTailLightsOn(value > 0.2);
  }

  /**
   * Resolves the current effective max steering angle (radians) from `carProperties.maxSteerAngle`,
   * scaling down with speed when that's given as a breakpoint array - see its TSDoc.
   */
  protected getMaxSteerAngle(): number {
    const maxSteerAngle = this.carProperties.maxSteerAngle;
    if (typeof maxSteerAngle === 'number') {
      return maxSteerAngle;
    }

    const speed = Math.abs(this.raycastVehicle.getSpeed());
    const breakpoints = maxSteerAngle;
    if (speed <= breakpoints[0].atSpeedMs) {
      return breakpoints[0].angleRad;
    }
    if (speed >= breakpoints[breakpoints.length - 1].atSpeedMs) {
      return breakpoints[breakpoints.length - 1].angleRad;
    }

    let index = 0;
    while (speed > breakpoints[index + 1].atSpeedMs) {
      index++;
    }
    const { atSpeedMs: x0, angleRad: y0 } = breakpoints[index];
    const { atSpeedMs: x1, angleRad: y1 } = breakpoints[index + 1];
    return y0 + ((y1 - y0) * (speed - x0)) / (x1 - x0);
  }

  // -1..1
  public set steeringFactor(value: number) {
    this.raycastVehicle.steeringAngle = value * this.getMaxSteerAngle();
  }

  public get steeringFactor(): number {
    return this.raycastVehicle.steeringAngle / this.getMaxSteerAngle();
  }

  protected handBrake$: BehaviorSubject<boolean> = new BehaviorSubject(false);

  public get handBrake(): boolean {
    return this.handBrake$.getValue();
  }

  public set handBrake(value: boolean) {
    this.handBrake$.next(value);
  }

  private _gear = 0;
  private _gear$: BehaviorSubject<number> = new BehaviorSubject<number>(0);

  get gear(): number {
    return this._gear;
  }

  get gear$(): Observable<number> {
    return this._gear$.asObservable();
  }

  /**
   * Selects a gear: `-1` reverse, `0` neutral, `1..gearRatios.length` forward. Any change into a
   * gear other than neutral starts a gear change of `transmission.shiftTime` ms (see
   * `isShifting`); a change while one is in progress restarts it.
   */
  set gear(value: number) {
    value = Math.max(-1, Math.min(this.carProperties.transmission.gearRatios.length, value));
    if (value === this._gear) {
      return;
    }
    this._gear = value;
    this._gear$.next(value);
    const shiftTime = this.carProperties.transmission.shiftTime;
    this._shiftRemainingMs = value !== 0 && shiftTime && shiftTime > 0 ? shiftTime : 0;
  }

  private _shiftRemainingMs = 0;

  /**
   * Whether a gear change is in progress (`transmission.shiftTime` ms of world time after `gear`
   * was set): the engine is disconnected from the wheels until it ends.
   */
  get isShifting(): boolean {
    return this._shiftRemainingMs > 0;
  }

  /** Milliseconds of world time left of the gear change in progress, `0` when none. */
  get shiftRemainingMs(): number {
    return this._shiftRemainingMs;
  }

  // TODO remove
  set isHonking(value: boolean) {}

  /**
   * Whether an automatic transmission (`carProperties.transmission.isAuto`) shifts gears by itself.
   * Default `true`. While `false` the auto-shift logic doesn't run and `gear` only ever changes from
   * outside. Also suspended automatically while the car is driven by remote input (a networked
   * replica takes its gear from the possessor's input instead of shifting on its own).
   */
  public autoShiftEnabled: boolean = true;

  // set while applyRemoteInput drives this car with a possessor's (non-null) input
  private _remoteInputActive: boolean = false;

  public readonly raycastVehicle: RVEntity;

  constructor(
    public readonly carProperties: GgCarProperties,
    chassis3D: TypeDoc['vTypeDoc']['displayObject'] | null,
    chassisBody: TypeDoc['pTypeDoc']['raycastVehicle'],
  ) {
    super();
    this.raycastVehicle = this.createRaycastVehicle(carProperties, chassis3D, chassisBody);
    this.addChildren(this.raycastVehicle);
  }

  protected createRaycastVehicle(
    carProperties: GgCarProperties,
    chassis3D: TypeDoc['vTypeDoc']['displayObject'] | null,
    chassisBody: TypeDoc['pTypeDoc']['raycastVehicle'],
  ): RVEntity {
    return new RaycastVehicle3dEntity(carProperties, chassis3D, chassisBody) as RVEntity;
  }

  onSpawned(world: Gg3dWorld<TypeDoc>) {
    super.onSpawned(world);
    // until removed: an entity may be removed from the world and added again
    this.tick$.pipe(takeUntil(this._onRemoved$)).subscribe(([_, delta]) => {
      this._shiftRemainingMs = Math.max(0, this._shiftRemainingMs - delta);
      this.updateEngine(delta);
      this.applyResistance(delta);
      if (this.raycastVehicle.isTouchingGround) {
        const { force, brake } = this.computeDrive();
        this.applyDrive(force, brake);
      }
    });
    if (this.carProperties.transmission.isAuto) {
      // checked every AUTO_SHIFT_INTERVAL of world time (on average, at any frame rate above
      // 1000 / AUTO_SHIFT_INTERVAL FPS), not every N ticks or wall-clock milliseconds: a paused,
      // slowed-down or manually stepped world shifts exactly like one running in real time
      let sinceShiftCheck = AUTO_SHIFT_INTERVAL;
      this.tick$.pipe(takeUntil(this._onRemoved$)).subscribe(([_, delta]) => {
        if (!this.autoShiftEnabled || this._remoteInputActive) {
          return;
        }
        sinceShiftCheck += delta;
        if (sinceShiftCheck < AUTO_SHIFT_INTERVAL) {
          return;
        }
        sinceShiftCheck = Math.min(sinceShiftCheck - AUTO_SHIFT_INTERVAL, AUTO_SHIFT_INTERVAL);
        if (!this.raycastVehicle.isTouchingGround || this.isShifting || this.gear <= 0) {
          return;
        }
        this.gear = this.selectAutoGear();
      });
    }
  }

  /**
   * The automatic transmission's choice of forward gear for the current engine rpm, given the
   * current forward gear (`gear > 0`): up while the rpm reaches the current gear's `upShifts`
   * entry (projecting the rpm into each next gear), otherwise down while the lower gear would
   * turn the engine at most its own `upShifts` entry less `downshiftMargin`. Override to
   * replace the shift logic; called every `AUTO_SHIFT_INTERVAL` ms of world time while the car
   * is on the ground, in a forward gear, not shifting, and not driven by remote input.
   */
  protected selectAutoGear(): number {
    const { gearRatios, upShifts, downshiftMargin } = this.carProperties.transmission;
    let gear = this.gear;
    let rpm = this.engineRpm;
    let upshifted = false;
    while (gear < gearRatios.length && rpm >= upShifts[gear - 1]) {
      rpm *= gearRatios[gear] / gearRatios[gear - 1];
      gear++;
      upshifted = true;
    }
    if (!upshifted) {
      while (gear > 1) {
        rpm *= gearRatios[gear - 2] / gearRatios[gear - 1];
        if (rpm > upShifts[gear - 2] - (downshiftMargin ?? 0)) {
          break;
        }
        gear--;
      }
    }
    return gear;
  }

  /**
   * This tick's drive force (Newtons for the whole car, signed along the car's forward axis) and
   * brake pedal (0..1) from the car's inputs and state, for `applyDrive`. Override to change how
   * the engine, the rev limiter, engine braking or `autoHold` turn into a force. Only called while
   * the car touches the ground.
   */
  protected computeDrive(): { force: number; brake: number } {
    let force = 0;
    let brake = this.brake;
    const calculatedRpm = this.calculateRpmFromCarSpeed();
    const direction = this.gear > 0 ? 1 : -1;
    if (this.gear === 0 || this.isShifting) {
      // engine disconnected from the wheels
      force = 0;
    } else if (calculatedRpm > this.carProperties.engine.maxRpm) {
      // rev limiter: throttle cut, plus the over-rev braking force against the direction of travel
      const overRevBrakeForce = this.carProperties.engine.overRevBrakeForce ?? DEFAULT_OVER_REV_BRAKE_FORCE;
      force = overRevBrakeForce > 0 ? -direction * overRevBrakeForce : this.engineBrakingForce(calculatedRpm);
    } else if (this.acceleration > 0) {
      force = this.tractionForce * this.acceleration;
    } else {
      force = this.engineBrakingForce(calculatedRpm);
    }
    // this functionality makes car stay still (parking gear) when speed is low
    if (this.carProperties.transmission.autoHold && !this.isShifting) {
      const speed = this.raycastVehicle.getSpeed();
      if (Math.abs(speed) < AUTO_HOLD_SPEED_THRESHOLD && (this.gear == 0 || this.acceleration <= 0)) {
        brake = Math.max(brake, (0.3 * (AUTO_HOLD_SPEED_THRESHOLD - speed)) / AUTO_HOLD_SPEED_THRESHOLD);
        force = 0;
      }
    }
    return { force, brake };
  }

  /**
   * Hands `computeDrive`'s result to the wheels: with the brake pedal released, `force` is split
   * between the axles by `tractionBias` and equally over each axle's wheels (so the whole car is
   * pushed by `force`, whatever its wheel count); with it pressed, the wheels brake with
   * `carProperties.brake`'s per-wheel forces instead. The handbrake then overrides the rear axle.
   */
  protected applyDrive(force: number, brake: number): void {
    if (brake === 0) {
      const bias = this.carProperties.tractionBias;
      const frontWheels = this.raycastVehicle.wheelCount('front');
      const rearWheels = this.raycastVehicle.wheelCount('rear');
      this.raycastVehicle.applyTraction('front', frontWheels ? (force * bias) / frontWheels : 0);
      this.raycastVehicle.applyTraction('rear', rearWheels ? (force * (1 - bias)) / rearWheels : 0);
      this.raycastVehicle.applyBrake('both', 0);
    } else {
      this.raycastVehicle.applyTraction('both', 0);
      this.raycastVehicle.applyBrake('front', brake * this.carProperties.brake.frontAxleForce);
      this.raycastVehicle.applyBrake('rear', brake * this.carProperties.brake.rearAxleForce);
    }
    if (this.handBrake) {
      this.raycastVehicle.applyTraction('rear', 0);
      this.raycastVehicle.applyBrake('rear', this.carProperties.brake.handbrakeForce);
    }
  }

  /**
   * Applies this tick's air drag (`carProperties.aerodynamics`) and rolling resistance
   * (`carProperties.rollingResistance`) to the chassis through `IRigidBodyComponent.applyForce`.
   * Both are off unless configured. Override to add other forces acting on the chassis each tick.
   */
  protected applyResistance(delta: number): void {
    const body = this.raycastVehicle.vehicleComponent;
    const velocity = body.linearVelocity;
    const speed = Pnt3.len(velocity);
    if (speed <= 0) {
      return;
    }
    const aero = this.carProperties.aerodynamics;
    if (aero) {
      const magnitude =
        0.5 * (aero.airDensity ?? DEFAULT_AIR_DENSITY) * aero.dragCoefficient * aero.frontalArea * speed * speed;
      body.applyForce(Pnt3.scalarMult(velocity, -magnitude / speed));
    }
    const rollingResistance = this.carProperties.rollingResistance;
    if (rollingResistance && delta > 0 && this.raycastVehicle.isTouchingGround) {
      const mass = body.bodyOptions.mass;
      const worldGravity = this.world?.physicsWorld?.gravity;
      const gravity = worldGravity ? Pnt3.len(worldGravity) : 9.82;
      // never more than what stops the car within this tick, so it can't push it backwards
      const magnitude = Math.min(rollingResistance * mass * gravity, (mass * speed) / (delta / 1000));
      body.applyForce(Pnt3.scalarMult(velocity, -magnitude / speed));
    }
  }

  protected updateEngine(delta: number) {
    delta = delta / 1000; // ms -> s
    // a gear change in progress cuts the throttle: the engine falls towards idle meanwhile
    const acceleration = this.isShifting ? 0 : this._acceleration$.getValue();
    let rpm = this.engineRpm;
    // engine connected to the wheels: the rpm follows the car's speed, within the engine's own rates
    const coupled = this.gear !== 0 && !this.isShifting && this.raycastVehicle.isTouchingGround;
    if (!coupled) {
      rpm +=
        (acceleration * 2 - 1) *
        (acceleration > 0.5
          ? this.carProperties.engine.maxRpmIncreasePerSecond
          : this.carProperties.engine.maxRpmDecreasePerSecond) *
        delta;
    } else {
      const rpmFromSpeed = this.calculateRpmFromCarSpeed();
      if (rpmFromSpeed > rpm) {
        rpm = Math.min(rpmFromSpeed, rpm + this.carProperties.engine.maxRpmIncreasePerSecond * delta);
      } else {
        rpm = Math.max(rpmFromSpeed, rpm - this.carProperties.engine.maxRpmDecreasePerSecond * delta);
      }
    }
    this._rpm$.next(Math.max(this.carProperties.engine.minRpm, Math.min(this.carProperties.engine.maxRpm, rpm)));
  }

  /**
   * `ISerializableEntity` implementation: returns `GgCar3DSettings`-shaped `config` - both the
   * construction-time tuning `carProperties` already holds (`engine`/`brake`/`transmission`/
   * `suspension`/`tractionBias`/`maxSteerAngle`/`mpsToRpmFactor`, plus `wheelBase`/`wheelOptions`
   * geometry) and what it doesn't: chassis `dimensions`/`material`/`body`, recovered from the live
   * chassis rigid body/mesh the same way `Gg3dLevelLoader`'s `"Primitive"` live serializer recovers
   * a primitive's own (see `IMaterialReadable3dComponent`) - plus a `state` block capturing this
   * car's current runtime-mutated driving state (`gear`/`acceleration`/`brake`/`handBrake`/
   * `steeringFactor`), none of which a spawn-time `config` alone could ever reflect, since all five
   * change continuously as the car is driven. `Gg3dLevelLoader.createGgCar` applies `state` back
   * onto a freshly-built car if present, after construction - see that method's own doc.
   *
   * Wheel/chassis `display`/`material` recovery only works for a mesh built via
   * `IDisplayObject3dComponentFactory.createPrimitive` (or a shortcut built on it) - see
   * `IMaterialReadable3dComponent`'s own doc; a chassis/wheel with no visual mesh at all
   * (`chassis3D`/a wheel's `displayObject` unset) simply omits `material`/`display`, same as
   * building one without `display`/`material` in the first place. `wheelObjectDirection`
   * round-trips exactly (already plain data on `RVEntitySharedWheelOptions.display`);
   * `autoScaleMesh` doesn't, since `Gg3dLevelLoader.resolveWheelDisplay` never sets it either.
   */
  public serializeSettings(): { config: Record<string, any> } {
    const {
      tractionBias,
      suspension,
      mpsToRpmFactor,
      engine,
      brake,
      transmission,
      maxSteerAngle,
      aerodynamics,
      rollingResistance,
    } = this.carProperties;

    const chassisBody = this.raycastVehicle.objectBody;
    const chassisShape = chassisBody?.debugBodySettings.shape;
    const chassisMaterial = isMaterialReadable3d(this.raycastVehicle.chassis3D)
      ? this.raycastVehicle.chassis3D.materialOptions
      : undefined;

    const config: Record<string, any> = {
      chassis: {
        ...(chassisShape?.shape === 'BOX' ? { dimensions: chassisShape.dimensions } : {}),
        ...(chassisMaterial !== undefined ? { material: chassisMaterial } : {}),
        ...(chassisBody ? { body: chassisBody.bodyOptions } : {}),
      },
      suspension,
      tractionBias,
      ...(mpsToRpmFactor !== undefined ? { mpsToRpmFactor } : {}),
      engine,
      brake,
      transmission,
      maxSteerAngle,
      ...(aerodynamics !== undefined ? { aerodynamics } : {}),
      ...(rollingResistance !== undefined ? { rollingResistance } : {}),
      state: {
        gear: this.gear,
        acceleration: this.acceleration,
        brake: this.brake,
        handBrake: this.handBrake,
        steeringFactor: this.steeringFactor,
      },
    };

    if ('wheelBase' in this.carProperties) {
      config.wheelBase = {
        ...(this.carProperties.wheelBase.shared
          ? { shared: this.serializeWheelFields(this.carProperties.wheelBase.shared) }
          : {}),
        front: this.serializeWheelFields(this.carProperties.wheelBase.front),
        rear: this.serializeWheelFields(this.carProperties.wheelBase.rear),
      };
    } else {
      config.wheelOptions = this.carProperties.wheelOptions.map(wheel => this.serializeWheelFields(wheel));
      if (this.carProperties.sharedWheelOptions) {
        config.sharedWheelOptions = this.serializeWheelFields(this.carProperties.sharedWheelOptions);
      }
    }

    return { config };
  }

  /**
   * Strips a wheel/axle settings object's live `display.displayObject` down to a JSON-safe
   * `{ material?, wheelObjectDirection? }` - see {@link serializeSettings}'s own doc for the
   * capability this depends on.
   */
  private serializeWheelFields<T extends { display?: WheelDisplayOptions }>(
    wheel: T,
  ): Omit<T, 'display'> & {
    display?: { material?: DisplayObject3dOpts<any>; wheelObjectDirection?: AxisDirection3 };
  } {
    const { display, ...rest } = wheel;
    if (!display) {
      return rest;
    }
    const material =
      display.displayObject && isMaterialReadable3d(display.displayObject)
        ? display.displayObject.materialOptions
        : undefined;
    if (material === undefined && display.wheelObjectDirection === undefined) {
      return rest;
    }
    return {
      ...rest,
      display: {
        ...(material !== undefined ? { material } : {}),
        ...(display.wheelObjectDirection !== undefined ? { wheelObjectDirection: display.wheelObjectDirection } : {}),
      },
    };
  }

  // TODO delete and let game application do all the steps
  public resetTo(
    options: {
      position?: Point3;
      rotation?: Point4;
    } = {},
  ) {
    this.raycastVehicle.resetTo(options);
    this.gear = 0;
    this._shiftRemainingMs = 0;
    this._rpm$.next(this.carProperties.engine.minRpm);
  }

  /** `INetworkSyncable`: the chassis body is this car's networked body; its own child entity isn't synced separately. */
  public get isNetworkSyncEnabled(): boolean {
    return !!this.raycastVehicle.objectBody;
  }

  /** `INetworkSyncable`: chassis snapshot plus driving state - see `GgCarNetState`. */
  public captureNetworkState(): GgCarNetState {
    return {
      ...RigidBodyCorrection.capture(this.raycastVehicle.vehicleComponent),
      gear: this.gear,
      shiftMs: this._shiftRemainingMs,
      steering: this.steeringFactor,
      accel: this.acceleration,
      brake: this.brake,
      handBrake: this.handBrake,
    };
  }

  /**
   * `INetworkSyncable`: correct the chassis toward the owner's snapshot (see `RigidBodyCorrection`)
   * and adopt its driving state - unless remote input drives this car, which already carries the
   * same values (see `applyRemoteInput`). A snap also resets the suspension, so the wheels don't
   * spring from the old pose. The gear change in progress is adopted as the owner has it
   * (`shiftMs`), not restarted by the replica's own `gear` setter, so the replica's engine
   * reconnects when the owner's does.
   */
  public applyNetworkState(target: GgCarNetState, ctx: NetworkApplyContext): CorrectionOutcome {
    const outcome = RigidBodyCorrection.correct(this.raycastVehicle.vehicleComponent, target, ctx);
    if (outcome === 'snap') {
      this.raycastVehicle.vehicleComponent.resetSuspension();
    }
    if (this._remoteInputActive) {
      return outcome;
    }
    this.gear = target.gear;
    this._shiftRemainingMs = Math.max(0, target.shiftMs - ctx.ageMs);
    this.steeringFactor = target.steering;
    this.acceleration = target.accel;
    this.brake = target.brake;
    this.handBrake = target.handBrake;
    return outcome;
  }

  /** `INetworkInputDriven`: what the local input driver set on this car. Ends any remote-input suspension of auto-shift. */
  public captureLocalInput(): GgCarInput {
    this._remoteInputActive = false;
    return {
      steeringFactor: this.steeringFactor,
      acceleration: this.acceleration,
      brake: this.brake,
      gear: this.gear,
      handBrake: this.handBrake,
    };
  }

  /**
   * `INetworkInputDriven`: drive this replica with the possessor's input. `null` is neutral:
   * throttle 0, steering 0, full brake, neutral gear, handbrake off. Auto-shift stays suspended
   * while non-null input arrives, since the gear comes from the possessor. A gear change in the
   * input starts the same `shiftTime` gear change here as on the possessor, through the `gear`
   * setter, so both engines reconnect after the same world time.
   */
  public applyRemoteInput(input: GgCarInput | null): void {
    if (input === null) {
      this._remoteInputActive = false;
      this.steeringFactor = 0;
      this.acceleration = 0;
      this.brake = 1;
      this.gear = 0;
      this.handBrake = false;
      return;
    }
    this._remoteInputActive = true;
    this.steeringFactor = input.steeringFactor;
    this.acceleration = input.acceleration;
    this.brake = input.brake;
    this.gear = input.gear;
    this.handBrake = input.handBrake;
  }
}
