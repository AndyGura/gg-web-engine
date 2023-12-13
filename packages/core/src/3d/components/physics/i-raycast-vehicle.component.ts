import { Point3, Point4 } from '../../../base';
import { IRigidBody3dComponent } from './i-rigid-body-3d.component';
import { PhysicsTypeDocRepo3D } from '../../gg-3d-world';

export type SuspensionOptions = {
  stiffness: number;
  damping: number;
  compression: number;
  restLength: number;
};

export type WheelOptions = {
  isLeft: boolean;
  isFront: boolean;
  tyreWidth: number;
  tyreRadius: number;
  position: Point3;
  frictionSlip: number; // friction with road
  rollInfluence: number;
  maxTravel: number;
};

export interface IRaycastVehicleComponent<TypeDoc extends PhysicsTypeDocRepo3D = PhysicsTypeDocRepo3D>
  extends IRigidBody3dComponent<TypeDoc> {
  /** Return speed in m/s, calculated by car itself (which should be shown on the speedometer) */
  get wheelSpeed(): number;

  addWheel(options: WheelOptions, suspensionOptions: SuspensionOptions): void;

  /** Set steering value for wheel. The unit of steering is radian */
  setSteering(wheelIndex: number, steering: number): void;

  /** Apply force to wheel. Units? */
  applyEngineForce(wheelIndex: number, force: number): void;

  /** Apply brake force to wheel. Units? */
  applyBrake(wheelIndex: number, force: number): void;

  isWheelTouchesGround(wheelIndex: number): boolean;

  getWheelTransform(wheelIndex: number): {
    position: Point3;
    rotation: Point4;
  };

  resetSuspension(): void;
}
