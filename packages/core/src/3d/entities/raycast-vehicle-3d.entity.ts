import { Box, IEntity, Pnt3, Point3, Point4, Qtrn } from '../../base';
import { Entity3d } from './entity-3d';
import { IDisplayObject3dComponent } from '../components/rendering/i-display-object-3d.component';
import {
  IRaycastVehicleComponent,
  SuspensionOptions,
  WheelDisplayOptions,
  WheelOptions,
} from '../components/physics/i-raycast-vehicle.component';
import { IRigidBody3dComponent } from '../components/physics/i-rigid-body-3d.component';
import { IPositionable3d } from '../interfaces/i-positionable-3d';

export type VehicleProperties = {
  typeOfDrive: 'RWD' | 'FWD' | '4WD';
  wheelOptions: WheelOptions[];
  suspension: SuspensionOptions;
};

export class RaycastVehicle3dEntity extends Entity3d {
  protected readonly wheels: ((IEntity & IPositionable3d) | null)[] = [];
  protected readonly wheelLocalRotation: (Point4 | null)[] = [];
  protected readonly frontWheelsIndices: number[] = [];
  protected readonly rearWheelsIndices: number[] = [];
  protected readonly tractionWheelIndices: number[] = [];

  // m/s
  public getSpeed(): number {
    return this.chassisBody.wheelSpeed;
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
    this.frontWheelsIndices.forEach(index => this.chassisBody.setSteering(index, value));
  }

  public applyTractionForce(force: number) {
    this.tractionWheelIndices.forEach(index => this.chassisBody.applyEngineForce(index, force));
  }

  public applyBrake(axle: 'front' | 'rear' | 'both', force: number) {
    if (axle != 'rear') {
      this.frontWheelsIndices.forEach(index => this.chassisBody.applyBrake(index, force));
    }
    if (axle != 'front') {
      this.rearWheelsIndices.forEach(index => this.chassisBody.applyBrake(index, force));
    }
  }

  /** car mesh and physics body direction has to be pointing: y front, z up*/
  constructor(
    public readonly carProperties: VehicleProperties,
    public readonly chassis3D: IDisplayObject3dComponent | null,
    public readonly chassisBody: IRaycastVehicleComponent,
    protected readonly wheelDisplaySettings: WheelDisplayOptions = {},
  ) {
    super(chassis3D, chassisBody);
    this.carProperties.wheelOptions.forEach((x, i) => {
      if (x.isFront) {
        this.frontWheelsIndices.push(i);
      } else {
        this.rearWheelsIndices.push(i);
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
    this.carProperties.wheelOptions.forEach(wheelOpts => {
      this.chassisBody.addWheel(wheelOpts, this.carProperties.suspension);
    });
    for (let i = 0; i < this.carProperties.wheelOptions.length; i++) {
      const options = this.carProperties.wheelOptions[i];
      const display: WheelDisplayOptions = {
        ...this.wheelDisplaySettings,
        ...(options.displaySettings || {}),
      };
      if (!display.displayObject) {
        this.wheels.push(null);
        this.wheelLocalRotation.push(null);
        continue;
      }
      const entity = display.displayObject.clone();
      if (display.autoScaleMesh) {
        const boundingBox = Box.expandByPoint(entity.getBoundings(), Pnt3.O);
        const scale = { ...Pnt3.O };
        const wheelObjectDirection = display.wheelObjectDirection || 'x';
        for (const dir of ['x', 'y', 'z'] as (keyof Point3)[]) {
          const isNormal = wheelObjectDirection.includes(dir);
          scale[dir] = isNormal
            ? options.tyre_width / (boundingBox.max[dir] - boundingBox.min[dir])
            : (options.tyre_radius * 2) / (boundingBox.max[dir] - boundingBox.min[dir]);
        }
        entity.scale = scale;
      }
      const direction = display.wheelObjectDirection || 'x';
      const flip = direction.includes('-') ? !options.isLeft : options.isLeft;
      let localRotation: Point4 | null = null;
      if (direction.includes('x')) {
        // rotate PI around Z if opposite position (x is correct for right wheel, -x is correct for left wheel)
        if (flip) localRotation = { x: 0, y: 0, z: 1, w: 0 };
      } else if (direction.includes('y')) {
        // rotate PI/2 around Z
        localRotation = { x: 0, y: 0, z: 0.707107 * (flip ? 1 : -1), w: 0.707107 };
      } else if (direction.includes('z')) {
        // rotate PI/2 around Y
        localRotation = { x: 0, y: 0.707107 * (flip ? -1 : 1), z: 0, w: 0.707107 };
      }
      this.wheelLocalRotation.push(localRotation);
      this.wheels.push(new Entity3d(entity));
    }
    this.addChildren(...(this.wheels.filter(x => !!x) as (IEntity & IPositionable3d)[]));
    this.chassisBody.entity = this;
  }

  protected runTransformBinding(objectBody: IRigidBody3dComponent, object3D: IDisplayObject3dComponent): void {
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
      wheel.position = position;
      wheel.rotation = rotation;
    }
  }

  public get isTouchingGround(): boolean {
    // is at least one traction wheel touches the ground
    return this.tractionWheelIndices
      .map(i => this.chassisBody.isWheelTouchesGround(i))
      .reduce((prev, cur) => cur || prev, false);
  }

  // TODO delete and let game application do all the steps
  public resetTo(
    options: {
      position?: Point3;
      rotation?: Point4;
    } = {},
  ) {
    this.chassisBody.resetMotion();
    this.chassisBody.resetSuspension();
    if (options.position) {
      this.position = options.position;
    }
    if (options.rotation) {
      this.rotation = options.rotation;
    }
    this.steeringAngle = 0;
  }
}
