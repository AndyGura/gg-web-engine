import { Point3, Point4 } from '../../base/models/points';
import { Gg3dEntity } from './gg-3d-entity';
import { IGg3dBody, IGg3dObject, IGg3dRaycastVehicle } from '../interfaces';
import { BehaviorSubject, filter, takeUntil } from 'rxjs';
import { throttleTime } from 'rxjs/operators';
import { GgPositionable3dEntity } from './gg-positionable-3d-entity';
import { Gg3dWorld } from '../gg-3d-world';
import { Box } from '../../base/math/box';
import { Qtrn } from '../../base/math/quaternion';
import { Pnt3 } from '../../base/math/point3';
import { AxisDirection3 } from '../../base/models/axis-directions';

export type WheelOptions = {
  tyre_width: number,
  tyre_radius: number,
  wheelObject?: IGg3dObject,
  wheelObjectDirection?: AxisDirection3,
  isLeft: boolean,
  isFront: boolean,
  position: Point3,
  frictionSlip: number,  // friction with road
  rollInfluence: number;
  maxTravel: number;
};

export type SuspensionOptions = {
  stiffness: number;
  damping: number;
  compression: number;
  restLength: number;
}

export type CarProperties = {
  typeOfDrive: 'RWD' | 'FWD' | '4WD';
  wheelOptions: WheelOptions[];
  mpsToRpmFactor?: number,
  engine: {
    minRpm: number;
    maxRpm: number;
    torques: { rpm: number, torque: number }[];
    maxRpmIncreasePerSecond: number;
    maxRpmDecreasePerSecond: number;
  },
  transmission: {
    isAuto: boolean,
    reverseGearRatio: number,
    gearRatios: number[];
    drivelineEfficiency: number;
    finalDriveRatio: number; // differential
    upShifts: number[],
  },
  suspension: SuspensionOptions,
};

export class Gg3dRaycastVehicleEntity extends Gg3dEntity {
  private readonly wheels: (GgPositionable3dEntity | null)[] = [];
  private readonly wheelLocalRotation: (Point4 | null)[] = [];
  private readonly wheelLocalTranslation: Point3[] = [];
  protected readonly frontWheelsIndices: number[] = [];
  protected readonly tractionWheelIndices: number[] = [];

  // https://x-engineer.org/vehicle-acceleration-maximum-speed-modeling-simulation/
  public readonly tractionWheelRadius: number;

  protected get dynamicTractionWheelRadius(): number {
    // The dynamic wheel radius [m] is the radius of the wheel when the vehicle is in motion. It is smaller than the static wheel radius rws because the tire is slightly compressed during vehicle motion.
    return 0.98 * this.tractionWheelRadius;
  }

  public get engineTorque(): number {
    const currentRPM = this.engineRpm;
    const maxMapTorque = this.carProperties.engine.torques[this.carProperties.engine.torques.length - 1].rpm;
    if (currentRPM >= maxMapTorque) {
      return Math.pow(Math.max(0, (1 - (currentRPM - maxMapTorque) / (this.carProperties.engine.maxRpm - maxMapTorque))), 2) * this.carProperties.engine.torques[this.carProperties.engine.torques.length - 1].torque;
    }
    let index = 0;
    let factor = 0;
    for (let i = 0; i < this.carProperties.engine.torques.length; i++) {
      if (this.carProperties.engine.torques[i].rpm < currentRPM) {
        index = i;
        continue;
      }
      factor = Math.max(0, (currentRPM - this.carProperties.engine.torques[index].rpm) / (this.carProperties.engine.torques[index + 1].rpm - this.carProperties.engine.torques[index].rpm));
      break;
    }
    if (factor === 0) {
      return this.carProperties.engine.torques[index].torque;
    } else {
      return this.carProperties.engine.torques[index].torque + factor * (this.carProperties.engine.torques[index + 1].torque - this.carProperties.engine.torques[index].torque)
    }
  }

  public get transmissionGearRatio(): number {
    if (this._gear == -1) {
      return this.carProperties.transmission.reverseGearRatio;
    }
    return this.carProperties.transmission.gearRatios[this._gear - 1] || 0;
  }

  protected get mpsToRpm(): number {
    return this.carProperties.mpsToRpmFactor || (30 * this.carProperties.transmission.finalDriveRatio / (Math.PI * this.dynamicTractionWheelRadius));
  }

  // m/s
  public getSpeed(): number {
    return this.chassisBody.wheelSpeed;
  }

  public calculateRpmFromCarSpeed(): number {
    return this.getSpeed() * this.mpsToRpm * this.transmissionGearRatio;
  }

  // TODO remove from here, end application should do this work

  public getDisplaySpeed(units: 'ms' | 'kmh' | 'mph' = 'ms'): number {
    if (units === 'ms') {
      return this.getSpeed();
    }
    const kmh = this.getSpeed() * 3.6;
    if (units === 'mph') {
      return kmh * 0.621371192;
    }
    return kmh;
  }

  protected readonly rpm$: BehaviorSubject<number> = new BehaviorSubject<number>(this.carProperties.engine.minRpm);

  public get engineRpm(): number {
    return this.rpm$.getValue();
  }

  protected get tractionForce(): number {
    return this.engineTorque * this.transmissionGearRatio * this.carProperties.transmission.finalDriveRatio * this.carProperties.transmission.drivelineEfficiency / this.dynamicTractionWheelRadius;
  }

  // TODO should be parameters
  private readonly _maxSteerVal = 0.35;
  private readonly brakingForce = 300;

  public get maxSteerVal(): number {
    return this._maxSteerVal;
  }

  private getMaxStableSteerVal(): number {
    const speed = this.getSpeed() * 3.6;
    if (speed < 40) {
      return this.maxSteerVal;
    }
    const mult = Math.pow((340 - speed) / 300, 2);
    return this.maxSteerVal * Math.max(mult, 0.06);
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
  protected acceleration$: BehaviorSubject<number> = new BehaviorSubject(0);

  protected get acceleration(): number {
    return this.acceleration$.getValue();
  }

  protected set acceleration(value: number) {
    this.acceleration$.next(value);
  }

  // 0..1
  protected brake$: BehaviorSubject<number> = new BehaviorSubject(0);

  protected get brake(): number {
    return this.brake$.getValue();
  }

  protected set brake(value: number) {
    this.brake$.next(value);
  }

  private _gear = 0;
  get gear(): number {
    return this._gear;
  }

  set gear(value: number) {
    if (value === this._gear) {
      return;
    }
    this._gear = Math.max(-1, Math.min(this.carProperties.transmission.gearRatios.length, value));
  }

  // TODO remove
  set isHonking(value: boolean) {
  }

  private _steeringValue: number = 0;
  public get steeringValue(): number {
    return this._steeringValue;
  }

  protected setSteeringValue(value: number) {
    if (this._steeringValue != value) {
      this._steeringValue = value;
    }
  }

  /** car mesh and physics body direction has to be pointing: y front, z up*/
  constructor(
    public readonly carProperties: CarProperties,
    public readonly chassis3D: IGg3dObject | null,
    public readonly chassisBody: IGg3dRaycastVehicle,
    public readonly wheelObject: IGg3dObject | null = null,
    public readonly wheelObjectDirection: AxisDirection3 = 'x',
  ) {
    super(chassis3D, chassisBody);
    this.carProperties.wheelOptions.forEach((x, i) => {
      if (x.isFront) {
        this.frontWheelsIndices.push(i);
      }
      if (x.isFront && this.carProperties.typeOfDrive != 'RWD') {
        this.tractionWheelIndices.push(i);
      }
      if (!x.isFront && this.carProperties.typeOfDrive != 'FWD') {
        this.tractionWheelIndices.push(i);
      }
    });
    this.tractionWheelRadius = this.carProperties.wheelOptions[this.tractionWheelIndices[0]].tyre_radius;
    // TODO perform this in a parent application
    // chassisBody.setDamping(0.02, 0.02); // TODO imitates air resistance. calculate from properties
    this.carProperties.wheelOptions.forEach((wheelOpts) => {
      this.chassisBody.addWheel(wheelOpts, this.carProperties.suspension);
    });
    if (this.wheelObject) {
      for (let i = 0; i < this.carProperties.wheelOptions.length; i++) {
        const options = this.carProperties.wheelOptions[i];
        if (!options.wheelObject && !this.wheelObject) {
          this.wheels.push(null);
          this.wheelLocalRotation.push(null);
          continue;
        }
        const entity = options.wheelObject || this.wheelObject.clone();
        const localTranslation = { x: options.tyre_width * (options.isLeft ? 1 : -1), y: 0, z: 0 };
        const boundingBox = Box.expandByPoint(entity.getBoundings(), { x: 0, y: 0, z: 0 });
        const scale: Point3 = { x: 0, y: 0, z: 0 };
        for (const dir of ['x', 'y', 'z'] as (keyof Point3)[]) {
          const wheelObjectDirection = (options.wheelObjectDirection || this.wheelObjectDirection);
          const isNormal = wheelObjectDirection.includes(dir);
          scale[dir] = isNormal
            ? options.tyre_width / (boundingBox.max[dir] - boundingBox.min[dir])
            : options.tyre_radius * 2 / (boundingBox.max[dir] - boundingBox.min[dir]);
          if (isNormal) {
            localTranslation.x += (wheelObjectDirection.startsWith('-') ? boundingBox.max[dir] : boundingBox.min[dir]) * scale[dir] * (options.isLeft ? 1 : -1)
          }
        }
        entity.scale = scale;
        const direction = options.wheelObjectDirection || this.wheelObjectDirection;
        const flip = direction.includes('-') ? !options.isLeft : options.isLeft;
        let localRotation: Point4 | null = null;
        if (direction.includes('x')) {
          // rotate PI around Z if opposite position (x is correct for right wheel, -x is correct for left wheel)
          if (flip) localRotation = { x: 0, y: 0, z: 1, w: 0};
        } else if (direction.includes('y')) {
          // rotate PI/2 around Z
          localRotation = { x: 0, y: 0, z: 0.707107 * (flip ? 1 : -1), w: 0.707107 };
        } else if (direction.includes('z')) {
          // rotate PI/2 around Y
          localRotation = { x: 0, y: 0.707107 * (flip ? -1 : 1), z: 0, w: 0.707107 };
        }
        this.wheelLocalTranslation.push(localTranslation);
        this.wheelLocalRotation.push(localRotation);
        this.wheels.push(new Gg3dEntity(entity));
      }
    }
    this._children = [...this.wheels.filter(x => !!x) as GgPositionable3dEntity[]];
  }

  onSpawned(world: Gg3dWorld) {
    super.onSpawned(world);
    this.tick$.subscribe(([_, delta]) => {
      this.updateEngine(delta);
      if (this.isTouchingGround) {
        // TODO 1 - R (1000 rpm) quick switch with acceleration pedal should have the same speed as without acceleration pedal
        let force;
        let brakeForce = this.brake;
        const calculatedRpm = this.calculateRpmFromCarSpeed();
        if (this.gear !== 0 && calculatedRpm > this.carProperties.engine.maxRpm) {
          // engine brake, this is related to clutch, better clutch condition - bigger force
          force = this.gear > 0 ? -12000 : 12000;
        } else {
          force = this.acceleration > 0
            ? this.tractionForce * this.acceleration // apply torque
            : 0.5 * (this.carProperties.engine.minRpm - calculatedRpm) * (this.gear > 0 ? 1 : -1); // released, use engine brake
          // this functionality makes car stay still (parking gear) when speed is low
          const speedThreshold = 3;
          if (Math.abs(this.getSpeed()) < speedThreshold && (this.gear == 0 || this.acceleration == 0)) {
            brakeForce = Math.max(brakeForce, 0.3 * (speedThreshold - this.getSpeed()) * this.brakingForce / speedThreshold);
            force = 0;
          }

        }
        const forcePerWheel = force / this.tractionWheelIndices.length;
        this.tractionWheelIndices.forEach(index => this.chassisBody.applyEngineForce(index, forcePerWheel));
        this.wheels.forEach((w, i) => this.chassisBody.applyBrake(i, brakeForce));
      }
    });
    if (this.carProperties.transmission.isAuto) {
      this.tick$.pipe(
        throttleTime(50),
        filter(() => this.isTouchingGround)
      ).subscribe(() => {
        let gear = this.gear;
        let upshifted = false;
        if (gear > 0) {
          let rpm = this.engineRpm;
          while (rpm >= this.carProperties.transmission.upShifts[gear - 1]) {
            rpm *= this.carProperties.transmission.gearRatios[gear] / this.carProperties.transmission.gearRatios[gear - 1];
            gear++;
            upshifted = true;
          }
          if (!upshifted) {
            while (gear > 1) {
              rpm *= this.carProperties.transmission.gearRatios[gear - 2] / this.carProperties.transmission.gearRatios[gear - 1];
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

  protected runTransformBinding(objectBody: IGg3dBody, object3D: IGg3dObject): void {
    super.runTransformBinding(objectBody, object3D);
    const carRotation = this.rotation;
    for (const [i, wheel] of (this.wheels || []).entries()) {
      if (!wheel) {
        continue;
      }
      let { position, rotation } = this.chassisBody.getWheelTransform(i);
      if (this.wheelLocalRotation[i]) {
        rotation = Qtrn.combineRotations(rotation, this.wheelLocalRotation[i]!);
      }
      position = Pnt3.add(position, Pnt3.rot(this.wheelLocalTranslation[i], carRotation));
      wheel.position = position;
      wheel.rotation = rotation;
    }
  }

  private get isTouchingGround(): boolean {
    // is at least one traction wheel touches the ground
    return this.tractionWheelIndices
      .map(i => this.chassisBody.isWheelTouchesGround(i))
      .reduce((prev, cur) => cur || prev, false);
  }

  private updateEngine(delta: number) {
    delta = delta / 1000; // ms -> s
    const acceleration = this.acceleration$.getValue();
    let rpm = this.engineRpm;
    // TODO here I will take perioud between gears and drift into account someday :)
    const gripKoeff = (this.gear === 0 || !this.isTouchingGround) ? 0 : 1;
    if (gripKoeff == 0) {
      rpm += (acceleration * 2 - 1)
        * (acceleration > 0.5 ? this.carProperties.engine.maxRpmIncreasePerSecond : this.carProperties.engine.maxRpmDecreasePerSecond)
        * delta;
    } else {
      const rpmFromSpeed = this.calculateRpmFromCarSpeed();
      if (rpmFromSpeed > rpm) {
        rpm = Math.min(rpmFromSpeed, rpm + this.carProperties.engine.maxRpmIncreasePerSecond * delta);
      } else {
        rpm = Math.max(rpmFromSpeed, rpm - this.carProperties.engine.maxRpmDecreasePerSecond * delta);
      }
    }
    this.rpm$.next(Math.max(
      this.carProperties.engine.minRpm,
      Math.min(
        this.carProperties.engine.maxRpm,
        rpm,
      ),
    ))
  }

  // TODO delete and let game application do all the steps
  resetTo(options: { position?: Point3, rotation?: Point4 } = {}) {
    this.chassisBody.resetMotion();
    this.chassisBody.resetSuspension();
    if (options.position) {
      this.position = options.position;
    }
    if (options.rotation) {
      this.rotation = options.rotation;
    }
    this._steeringValue = 0;
    this.gear = 0;
    this.rpm$.next(this.carProperties.engine.minRpm);
  }

// TODO refactor: control has to be in control service, here we receive separately braking, acceleration, steering
  public setXAxisControlValue(value: number) {
    const steering = this.getMaxStableSteerVal() * value;
    this.frontWheelsIndices.forEach(index => this.chassisBody.setSteering(index, -steering));
    this.setSteeringValue(-steering);
  }

  // TODO refactor: control has to be in control service, here we receive separately braking, acceleration, steering
  public setYAxisControlValue(value: number) {
    if (value > 0) {
      this.acceleration = value;
      this.brake = 0;
    } else {
      this.acceleration = 0;
      this.brake = -this.brakingForce * value;
    }
    this.setTailLightsOn(value < 0);
  }
}
