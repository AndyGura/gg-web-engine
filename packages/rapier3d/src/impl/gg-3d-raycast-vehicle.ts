import {
  Gg3dRaycastVehicleEntity,
  IGg3dRaycastVehicle,
  Pnt3,
  Point3,
  Point4,
  Qtrn,
  SuspensionOptions,
  WheelOptions,
} from '@gg-web-engine/core';
import { Gg3dPhysicsWorld } from './gg-3d-physics-world';
import { DynamicRayCastVehicleController, Vector3 } from '@dimforge/rapier3d';
import { Gg3dBody } from './bodies/gg-3d-body';

export class Gg3dRaycastVehicle extends Gg3dBody implements IGg3dRaycastVehicle {
  protected _nativeVehicle: DynamicRayCastVehicleController | null = null;

  public get nativeVehicle(): DynamicRayCastVehicleController | null {
    return this._nativeVehicle;
  }

  public entity: Gg3dRaycastVehicleEntity | null = null;

  private wheelDescr: [Vector3, Vector3, Vector3, number, number][] = [];

  constructor(protected readonly world: Gg3dPhysicsWorld, private chassisBody: Gg3dBody) {
    super(world, ...chassisBody.factoryProps);
  }

  get wheelSpeed(): number {
    return (this.nativeVehicle?.currentVehicleSpeed() || 0) / 3.6;
  }

  addToWorld(world: Gg3dPhysicsWorld) {
    super.addToWorld(world);
    this._nativeVehicle = new DynamicRayCastVehicleController(
      this._nativeBody!,
      world.nativeWorld!.bodies,
      world.nativeWorld!.colliders,
      world.nativeWorld!.queryPipeline,
    );
    for (const descr of this.wheelDescr) {
      this._nativeVehicle.addWheel(...descr);
    }
  }

  addWheel(options: WheelOptions, suspensionOptions: SuspensionOptions): void {
    const descr: [Vector3, Vector3, Vector3, number, number] = [
      new Vector3(options.position.x, options.position.y, options.position.z - 1),
      Pnt3.nZ,
      options.isLeft ? Pnt3.X : Pnt3.nX,
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

  updateVehicleSimulation(deltaMS: number) {
    if (!this.nativeVehicle) return;
    this.nativeVehicle.updateVehicle(deltaMS / 1000);
  }

  dispose() {
    this.nativeVehicle?.free();
    super.dispose();
  }
}
