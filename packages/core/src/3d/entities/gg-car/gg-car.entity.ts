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
  Point3,
  Point4,
  RigidBodyCorrection,
  RigidBodyNetState,
  TickOrder,
} from '../../../base';
import { BehaviorSubject, filter, Observable, takeUntil, throttleTime } from 'rxjs';
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
  };
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
    upShifts: number[];
    autoHold: boolean;
  };
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

  protected get tractionForce(): number {
    return (
      (this.engineTorque *
        this.transmissionGearRatio *
        this.carProperties.transmission.finalDriveRatio *
        this.carProperties.transmission.drivelineEfficiency) /
      this.raycastVehicle.tractionWheelRadius
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

  set gear(value: number) {
    value = Math.max(-1, Math.min(this.carProperties.transmission.gearRatios.length, value));
    if (value === this._gear) {
      return;
    }
    this._gear = value;
    this._gear$.next(value);
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
      this.updateEngine(delta);
      if (this.raycastVehicle.isTouchingGround) {
        // TODO 1 - R (1000 rpm) quick switch with acceleration pedal should have the same speed as without acceleration pedal
        let force = 0;
        let brake = this.brake;
        const calculatedRpm = this.calculateRpmFromCarSpeed();
        if (this.gear !== 0 && calculatedRpm > this.carProperties.engine.maxRpm) {
          // engine brake, this is related to clutch, better clutch condition - bigger force
          force = this.gear > 0 ? -12000 : 12000;
        } else {
          force =
            this.acceleration > 0
              ? this.tractionForce * this.acceleration // apply torque
              : 0.5 * (this.carProperties.engine.minRpm - calculatedRpm) * (this.gear > 0 ? 1 : -1); // released, use engine brake
          // this functionality makes car stay still (parking gear) when speed is low
          if (this.carProperties.transmission.autoHold) {
            const speedThreshold = 3;
            if (
              Math.abs(this.raycastVehicle.getSpeed()) < speedThreshold &&
              (this.gear == 0 || this.acceleration <= 0)
            ) {
              brake = Math.max(brake, (0.3 * (speedThreshold - this.raycastVehicle.getSpeed())) / speedThreshold);
              force = 0;
            }
          }
        }
        if (brake === 0) {
          this.raycastVehicle.applyTraction('front', force * this.carProperties.tractionBias);
          this.raycastVehicle.applyTraction('rear', force * (1 - this.carProperties.tractionBias));
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
    });
    if (this.carProperties.transmission.isAuto) {
      this.tick$
        .pipe(
          filter(() => this.autoShiftEnabled && !this._remoteInputActive),
          throttleTime(50),
          filter(() => this.raycastVehicle.isTouchingGround),
        )
        .subscribe(() => {
          let gear = this.gear;
          let upshifted = false;
          if (gear > 0) {
            let rpm = this.engineRpm;
            while (rpm >= this.carProperties.transmission.upShifts[gear - 1]) {
              rpm *=
                this.carProperties.transmission.gearRatios[gear] / this.carProperties.transmission.gearRatios[gear - 1];
              gear++;
              upshifted = true;
            }
            if (!upshifted) {
              while (gear > 1) {
                rpm *=
                  this.carProperties.transmission.gearRatios[gear - 2] /
                  this.carProperties.transmission.gearRatios[gear - 1];
                if (rpm > this.carProperties.transmission.upShifts[gear - 2]) {
                  break;
                }
                gear--;
              }
            }
            this.gear = gear;
          }
        });
    }
  }

  protected updateEngine(delta: number) {
    delta = delta / 1000; // ms -> s
    const acceleration = this._acceleration$.getValue();
    let rpm = this.engineRpm;
    // TODO here I will take perioud between gears and drift into account someday :)
    const gripKoeff = this.gear === 0 || !this.raycastVehicle.isTouchingGround ? 0 : 1;
    if (gripKoeff == 0) {
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
    const { tractionBias, suspension, mpsToRpmFactor, engine, brake, transmission, maxSteerAngle } = this.carProperties;

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
   * spring from the old pose.
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
   * while non-null input arrives, since the gear comes from the possessor.
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
