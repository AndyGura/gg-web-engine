import { AxisDirection3, Box, IEntity, Pnt3, Point3, Point4, Qtrn } from '../../base';
import { Entity3d } from './entity-3d';
import { IDisplayObject3dComponent } from '../components/rendering/i-display-object-3d.component';
import {
  IRaycastVehicleComponent,
  SuspensionOptions,
  WheelOptions,
} from '../components/physics/i-raycast-vehicle.component';
import { IRigidBody3dComponent } from '../components/physics/i-rigid-body-3d.component';
import { IPositionable3d } from '../interfaces/i-positionable-3d';
import { Gg3dWorldTypeDocRepo } from '../gg-3d-world';

export type WheelDisplayOptions = {
  displayObject?: IDisplayObject3dComponent;
  wheelObjectDirection?: AxisDirection3;
  autoScaleMesh?: boolean;
};

/**
 * Wheel settings shared by several wheels. Anything left out takes the default: `tyreWidth` 0.3,
 * `tyreRadius` 0.4, `frictionSlip` 1.2 (street tyres - see `WheelOptions.frictionSlip`),
 * `rollInfluence` 0.2, `sideFrictionStiffness` 1, `maxTravel` equal to `suspension.restLength` (the wheel compresses at most
 * up to its connection point), `maxSuspensionForce` per `defaultMaxSuspensionForce`.
 */
export type RVEntitySharedWheelOptions = {
  tyreWidth?: number;
  tyreRadius?: number;
  frictionSlip?: number;
  rollInfluence?: number;
  sideFrictionStiffness?: number;
  maxTravel?: number;
  maxSuspensionForce?: number;
  display?: WheelDisplayOptions;
};

export type RVEntityAxleOptions = {
  halfAxleWidth: number;
  axlePosition: number;
  axleHeight: number;
} & RVEntitySharedWheelOptions;

export enum RVEntityTractionBias {
  FWD = 1,
  RWD = 0,
}

export type RVEntityProperties = {
  tractionBias: RVEntityTractionBias | number;
  suspension: SuspensionOptions;
} & (
  | {
      wheelBase: {
        shared: RVEntitySharedWheelOptions;
        front: RVEntityAxleOptions;
        rear: RVEntityAxleOptions;
      };
    }
  | {
      wheelOptions: (RVEntitySharedWheelOptions & {
        isLeft: boolean;
        isFront: boolean;
        position: Point3;
      })[];
      sharedWheelOptions?: RVEntitySharedWheelOptions;
    }
);

// see RVEntitySharedWheelOptions; maxTravel's default depends on the suspension, so it's filled in
// the constructor
const wheelDefaults = {
  tyreWidth: 0.3,
  tyreRadius: 0.4,
  frictionSlip: 1.2,
  rollInfluence: 0.2,
};

/**
 * A raycast vehicle: a chassis rigid body whose wheels are rays with simulated suspension, from
 * the physics adapter's own vehicle implementation. It has no engine or gearbox - apply forces per
 * axle with `applyTraction`/`applyBrake` (Newtons per wheel) and set `steeringAngle` (radians), or
 * use `GgCarEntity`, which adds a full drivetrain on top. Local axes: +X right, +Y forward, +Z up.
 * Suspension and tyre grip are simulated differently by each physics adapter, so tune the wheel
 * options on the backend you ship.
 *
 * @example
 * ```ts
 * import { RaycastVehicle3dEntity, RVEntityTractionBias } from '@gg-web-engine/core';
 *
 * const chassisSize = { x: 1.8, y: 4, z: 0.6 }; // 1.8 m wide, 4 m long (+Y is forward)
 * const vehicle = new RaycastVehicle3dEntity(
 *   {
 *     suspension: { stiffness: 20, damping: 2.3, compression: 4.4, restLength: 0.6 },
 *     tractionBias: RVEntityTractionBias.RWD,
 *     wheelBase: {
 *       shared: { tyreRadius: 0.4, tyreWidth: 0.3 },
 *       front: { halfAxleWidth: 1, axlePosition: 1.7, axleHeight: 0.3 },
 *       rear: { halfAxleWidth: 1, axlePosition: -1, axleHeight: 0.3 },
 *     },
 *   },
 *   world.visualScene.factory.createBox(chassisSize, { color: 0xcc0000 }),
 *   world.physicsWorld.factory.createRaycastVehicle(
 *     world.physicsWorld.factory.createRigidBody({ shape: { shape: 'BOX', dimensions: chassisSize }, body: { mass: 800 } }),
 *   ),
 * );
 * vehicle.position = { x: 0, y: 0, z: 2 };
 * world.addEntity(vehicle);
 *
 * // every tick, e.g. from your own input handling:
 * vehicle.applyTraction('rear', 2000);
 * vehicle.steeringAngle = 0.2;
 * console.log(vehicle.getSpeed() * 3.6, 'km/h');
 * ```
 */
export class RaycastVehicle3dEntity<
  TypeDoc extends Gg3dWorldTypeDocRepo = Gg3dWorldTypeDocRepo,
> extends Entity3d<TypeDoc> {
  static readonly entityTypeName: string = 'RaycastVehicle3dEntity';
  protected readonly wheels: (Entity3d<TypeDoc> | null)[] = [];
  protected readonly wheelLocalRotation: (Point4 | null)[] = [];
  protected readonly frontWheelsIndices: number[] = [];
  protected readonly rearWheelsIndices: number[] = [];

  get name(): string {
    return super.name;
  }

  set name(value: string) {
    const oldName = super.name;
    super.name = value;
    for (const w of this.wheels || []) {
      if (w) {
        w.name = w.name.replace(oldName, value);
      }
    }
  }

  // m/s
  public getSpeed(): number {
    return this.vehicleComponent.wheelSpeed;
  }

  public readonly tractionWheelRadius: number;

  private _steeringAngle: number = 0;
  public get steeringAngle(): number {
    return this._steeringAngle;
  }

  public set steeringAngle(value: number) {
    if (this._steeringAngle != value) {
      this._steeringAngle = value;
    }
    this.frontWheelsIndices.forEach(index => this.vehicleComponent.setSteering(index, value));
  }

  /** Sets the engine force of every wheel of `axle`, in Newtons per wheel - see `IRaycastVehicleComponent.applyEngineForce`. */
  public applyTraction(axle: 'front' | 'rear' | 'both', force: number) {
    if (axle != 'rear') {
      this.frontWheelsIndices.forEach(index => this.vehicleComponent.applyEngineForce(index, force));
    }
    if (axle != 'front') {
      this.rearWheelsIndices.forEach(index => this.vehicleComponent.applyEngineForce(index, force));
    }
  }

  /** Sets the brake force of every wheel of `axle`, in Newtons per wheel - see `IRaycastVehicleComponent.applyBrake`. */
  public applyBrake(axle: 'front' | 'rear' | 'both', force: number) {
    if (axle != 'rear') {
      this.frontWheelsIndices.forEach(index => this.vehicleComponent.applyBrake(index, force));
    }
    if (axle != 'front') {
      this.rearWheelsIndices.forEach(index => this.vehicleComponent.applyBrake(index, force));
    }
  }

  /**
   * Sets the tyre friction coefficient of every wheel of `axle` - see
   * `IRaycastVehicleComponent.setWheelFrictionSlip`. Lets a handbrake or a surface change retune
   * grip without touching the physics backend.
   */
  public setFrictionSlip(axle: 'front' | 'rear' | 'both', frictionSlip: number) {
    if (axle != 'rear') {
      this.frontWheelsIndices.forEach(index => this.vehicleComponent.setWheelFrictionSlip(index, frictionSlip));
    }
    if (axle != 'front') {
      this.rearWheelsIndices.forEach(index => this.vehicleComponent.setWheelFrictionSlip(index, frictionSlip));
    }
  }

  /** How many wheels `axle` has (`'both'`: all wheels). */
  public wheelCount(axle: 'front' | 'rear' | 'both'): number {
    return (
      (axle != 'rear' ? this.frontWheelsIndices.length : 0) + (axle != 'front' ? this.rearWheelsIndices.length : 0)
    );
  }

  /** car mesh and physics body direction has to be pointing: y front, z up*/
  constructor(
    public readonly carProperties: RVEntityProperties,
    public readonly chassis3D: IDisplayObject3dComponent | null,
    public readonly vehicleComponent: IRaycastVehicleComponent,
  ) {
    super({ object3D: chassis3D, objectBody: vehicleComponent });
    const withSuspensionDefaults = <T extends { maxTravel?: number }>(o: T): T & { maxTravel: number } => ({
      ...o,
      maxTravel: o.maxTravel ?? carProperties.suspension.restLength,
    });
    let wheelFullOptions: (WheelOptions & { display: WheelDisplayOptions })[] =
      'wheelBase' in carProperties
        ? [
            carProperties.wheelBase.front,
            carProperties.wheelBase.front,
            carProperties.wheelBase.rear,
            carProperties.wheelBase.rear,
          ].map((a, i) =>
            withSuspensionDefaults({
              ...wheelDefaults,
              ...(carProperties.wheelBase.shared || {}),
              ...a,
              isFront: i < 2,
              isLeft: i % 2 === 0,
              position: {
                x: a.halfAxleWidth * (i % 2 === 0 ? 1 : -1),
                y: a.axlePosition,
                z: a.axleHeight,
              },
              display: {
                ...(carProperties.wheelBase.shared?.display || {}),
                ...(a.display || {}),
              },
            }),
          )
        : carProperties.wheelOptions.map((x, i) =>
            withSuspensionDefaults({
              ...wheelDefaults,
              ...(carProperties.sharedWheelOptions || {}),
              ...x,
              display: {
                ...(carProperties.sharedWheelOptions?.display || {}),
                ...(x.display || {}),
              },
            }),
          );
    // TODO perform this in a parent application
    // chassisBody.setDamping(0.02, 0.02); // TODO imitates air resistance. calculate from properties
    wheelFullOptions.forEach((wheelOpts, i) => {
      if (wheelOpts.isFront) {
        this.frontWheelsIndices.push(i);
      } else {
        this.rearWheelsIndices.push(i);
      }
      this.vehicleComponent.addWheel(wheelOpts, this.carProperties.suspension);
    });
    this.tractionWheelRadius =
      wheelFullOptions[this.frontWheelsIndices[0]].tyreRadius * this.carProperties.tractionBias +
      wheelFullOptions[this.rearWheelsIndices[0]].tyreRadius * (1 - this.carProperties.tractionBias);
    for (const options of wheelFullOptions) {
      const display = options.display || {};
      if (!display.displayObject) {
        this.wheels.push(null);
        this.wheelLocalRotation.push(null);
        continue;
      }
      const displayObj = display.displayObject.clone();
      if (display.autoScaleMesh) {
        const boundingBox = Box.expandByPoint(displayObj.getBoundings(), Pnt3.O);
        const scale = { ...Pnt3.O };
        const wheelObjectDirection = display.wheelObjectDirection || 'x';
        for (const dir of ['x', 'y', 'z'] as (keyof Point3)[]) {
          const isNormal = wheelObjectDirection.includes(dir);
          scale[dir] = isNormal
            ? options.tyreWidth / (boundingBox.max[dir] - boundingBox.min[dir])
            : (options.tyreRadius * 2) / (boundingBox.max[dir] - boundingBox.min[dir]);
        }
        displayObj.scale = scale;
      }
      const direction = display.wheelObjectDirection || 'x';
      const flip = direction.includes('-') ? options.isLeft : !options.isLeft;
      let localRotation: Point4 | null = null;
      if (direction.includes('x')) {
        // rotate PI around Z if opposite position (x is correct for left wheel, -x is correct for right wheel)
        if (flip) localRotation = { x: 0, y: 0, z: 1, w: 0 };
      } else if (direction.includes('y')) {
        // rotate PI/2 around Z
        localRotation = { x: 0, y: 0, z: 0.707107 * (flip ? 1 : -1), w: 0.707107 };
      } else if (direction.includes('z')) {
        // rotate PI/2 around Y
        localRotation = { x: 0, y: 0.707107 * (flip ? 1 : -1), z: 0, w: 0.707107 };
      }
      this.wheelLocalRotation.push(localRotation);
      const wheelEntity = new Entity3d<TypeDoc>({ object3D: displayObj });
      wheelEntity.name = this.name + '__wheel_' + (options.isFront ? 'f' : 'r') + (options.isLeft ? 'l' : 'r');
      this.wheels.push(wheelEntity);
    }
    this.addChildren(...(this.wheels.filter(x => !!x) as (IEntity & IPositionable3d)[]));
    this.vehicleComponent.entity = this;
  }

  protected runTransformBinding(objectBody: IRigidBody3dComponent, object3D: IDisplayObject3dComponent): void {
    super.runTransformBinding(objectBody, object3D);
    for (const [i, wheel] of (this.wheels || []).entries()) {
      if (!wheel) {
        continue;
      }
      let { position, rotation } = this.vehicleComponent.getWheelTransform(i);
      if (this.wheelLocalRotation[i]) {
        rotation = Qtrn.combineRotations(rotation, this.wheelLocalRotation[i]!);
      }
      wheel.position = position;
      wheel.rotation = rotation;
    }
  }

  public get isTouchingGround(): boolean {
    // is at least one traction wheel touches the ground
    if (this.carProperties.tractionBias != RVEntityTractionBias.RWD) {
      if (
        this.frontWheelsIndices
          .map(i => this.vehicleComponent.isWheelTouchesGround(i))
          .reduce((prev, cur) => cur || prev, false)
      ) {
        return true;
      }
    }
    if (this.carProperties.tractionBias != RVEntityTractionBias.FWD) {
      if (
        this.rearWheelsIndices
          .map(i => this.vehicleComponent.isWheelTouchesGround(i))
          .reduce((prev, cur) => cur || prev, false)
      ) {
        return true;
      }
    }
    return false;
  }

  // TODO delete and let game application do all the steps
  public resetTo(
    options: {
      position?: Point3;
      rotation?: Point4;
    } = {},
  ) {
    if (options.position) {
      this.position = options.position;
    }
    if (options.rotation) {
      this.rotation = options.rotation;
    }
    this.steeringAngle = 0;
    this.vehicleComponent.resetMotion();
  }
}
