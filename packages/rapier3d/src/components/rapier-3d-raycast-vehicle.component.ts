import {
  Gg3dWorld,
  IRaycastVehicleComponent,
  IVisualScene3dComponent,
  Pnt3,
  Point3,
  Point4,
  Qtrn,
  SuspensionOptions,
  WheelOptions,
} from '@gg-web-engine/core';
import { DynamicRayCastVehicleController, Vector3 } from '@dimforge/rapier3d-compat';
import { Rapier3dRigidBodyComponent } from './rapier-3d-rigid-body.component';
import { Rapier3dWorldComponent } from './rapier-3d-world.component';

export class Rapier3dRaycastVehicleComponent
  extends Rapier3dRigidBodyComponent
  implements IRaycastVehicleComponent<Rapier3dWorldComponent>
{
  protected _nativeVehicle: DynamicRayCastVehicleController | null = null;

  public get nativeVehicle(): DynamicRayCastVehicleController | null {
    return this._nativeVehicle;
  }

  private wheelDescr: [Vector3, Vector3, Vector3, number, number][] = [];

  constructor(protected readonly world: Rapier3dWorldComponent, private chassisBody: Rapier3dRigidBodyComponent) {
    super(world, ...chassisBody.factoryProps);
  }

  get wheelSpeed(): number {
    return (this.nativeVehicle?.currentVehicleSpeed() || 0) / 3.6;
  }

  addToWorld(world: Gg3dWorld<IVisualScene3dComponent, Rapier3dWorldComponent>) {
    super.addToWorld(world);
    this._nativeVehicle = world.physicsWorld.nativeWorld.createVehicleController(this._nativeBody!);
    for (const descr of this.wheelDescr) {
      this._nativeVehicle.addWheel(...descr);
    }
  }

  removeFromWorld(world: Gg3dWorld<IVisualScene3dComponent, Rapier3dWorldComponent>) {
    if (world.physicsWorld != this.world) {
      throw new Error('Rapier3D bodies cannot be shared between different worlds');
    }
    if (this.nativeVehicle) {
      world.physicsWorld.nativeWorld.removeVehicleController(this.nativeVehicle);
    }
    super.removeFromWorld(world);
  }

  addWheel(options: WheelOptions, suspensionOptions: SuspensionOptions): void {
    const descr: [Vector3, Vector3, Vector3, number, number] = [
      new Vector3(options.position.x, options.position.y, options.position.z - 1),
      { x: 0, y: 0, z: -1 }, // TODO Pnt3.nZ,
      options.isLeft ? Pnt3.X : { x: -1, y: 0, z: 0 }, // TODO Pnt3.nX,
      suspensionOptions.restLength,
      options.tyre_radius,
    ];
    this.wheelDescr.push(descr);
    if (this.nativeVehicle) {
      this.nativeVehicle.addWheel(...descr);
    }
  }

  setSteering(wheelIndex: number, steering: number): void {
    if (!this.nativeVehicle) return;
    this.nativeVehicle.setWheelSteering(wheelIndex, steering);
  }

  applyEngineForce(wheelIndex: number, force: number): void {
    if (!this.nativeVehicle) return;
    this.nativeVehicle.setWheelEngineForce(wheelIndex, force);
  }

  applyBrake(wheelIndex: number, force: number): void {
    this.nativeVehicle?.setWheelBrake(wheelIndex, force);
  }

  isWheelTouchesGround(wheelIndex: number): boolean {
    if (!this.nativeVehicle) return false;
    // TODO
    return true; //this.nativeVehicle.wheelIsInContact(wheelIndex);
  }

  getWheelTransform(wheelIndex: number): { position: Point3; rotation: Point4 } {
    if (!this.nativeVehicle) return { position: Pnt3.O, rotation: Qtrn.O };
    const chassisRotation = this.rotation;
    return {
      position: Pnt3.add(
        this.position,
        Pnt3.rot(this.nativeVehicle.wheelChassisConnectionPointCs(wheelIndex) as any, chassisRotation),
      ),
      rotation: chassisRotation,
    };
  }

  resetSuspension(): void {
    // TODO
  }

  dispose() {
    this.nativeVehicle?.free();
    super.dispose();
  }
}
