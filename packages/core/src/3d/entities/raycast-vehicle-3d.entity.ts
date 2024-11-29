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
import { PhysicsTypeDocRepo3D, VisualTypeDocRepo3D } from '../gg-3d-world';

export type WheelDisplayOptions = {
  displayObject?: IDisplayObject3dComponent;
  wheelObjectDirection?: AxisDirection3;
  autoScaleMesh?: boolean;
};

export type RVEntitySharedWheelOptions = {
  tyreWidth?: number;
  tyreRadius?: number;
  frictionSlip?: number;
  rollInfluence?: number;
  maxTravel?: number;
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

const wheeelDefaults = {
  tyreWidth: 0.3,
  tyreRadius: 0.4,
  frictionSlip: 1000,
  rollInfluence: 0.2,
  maxTravel: 0.5,
};

export class RaycastVehicle3dEntity<
  VTypeDoc extends VisualTypeDocRepo3D = VisualTypeDocRepo3D,
  PTypeDoc extends PhysicsTypeDocRepo3D = PhysicsTypeDocRepo3D,
> extends Entity3d<VTypeDoc, PTypeDoc> {
  protected readonly wheels: (Entity3d<VTypeDoc, PTypeDoc> | null)[] = [];
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

  public applyTraction(axle: 'front' | 'rear' | 'both', force: number) {
    if (axle != 'rear') {
      this.frontWheelsIndices.forEach(index => this.vehicleComponent.applyEngineForce(index, force));
    }
    if (axle != 'front') {
      this.rearWheelsIndices.forEach(index => this.vehicleComponent.applyEngineForce(index, force));
    }
  }

  public applyBrake(axle: 'front' | 'rear' | 'both', force: number) {
    if (axle != 'rear') {
      this.frontWheelsIndices.forEach(index => this.vehicleComponent.applyBrake(index, force));
    }
    if (axle != 'front') {
      this.rearWheelsIndices.forEach(index => this.vehicleComponent.applyBrake(index, force));
    }
  }

  /** car mesh and physics body direction has to be pointing: y front, z up*/
  constructor(
    public readonly carProperties: RVEntityProperties,
    public readonly chassis3D: IDisplayObject3dComponent | null,
    public readonly vehicleComponent: IRaycastVehicleComponent,
  ) {
    super({ object3D: chassis3D, objectBody: vehicleComponent });
    let wheelFullOptions: (WheelOptions & { display: WheelDisplayOptions })[] =
      'wheelBase' in carProperties
        ? [
            carProperties.wheelBase.front,
            carProperties.wheelBase.front,
            carProperties.wheelBase.rear,
            carProperties.wheelBase.rear,
          ].map((a, i) => ({
            ...wheeelDefaults,
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
          }))
        : carProperties.wheelOptions.map((x, i) => ({
            ...wheeelDefaults,
            ...(carProperties.sharedWheelOptions || {}),
            ...x,
            display: {
              ...(carProperties.sharedWheelOptions?.display || {}),
              ...(x.display || {}),
            },
          }));
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
      const wheelEntity = new Entity3d<VTypeDoc, PTypeDoc>({ object3D: displayObj });
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
