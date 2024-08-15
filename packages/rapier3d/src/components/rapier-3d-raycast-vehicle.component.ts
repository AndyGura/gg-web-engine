import {
  Gg3dWorld,
  IRaycastVehicleComponent,
  IVisualScene3dComponent,
  Pnt3,
  Point3,
  Point4,
  Qtrn,
  SuspensionOptions,
  VisualTypeDocRepo3D,
  WheelOptions,
} from '@gg-web-engine/core';
import { DynamicRayCastVehicleController, Vector3 } from '@dimforge/rapier3d-compat';
import { Rapier3dRigidBodyComponent } from './rapier-3d-rigid-body.component';
import { Rapier3dWorldComponent } from './rapier-3d-world.component';
import { Rapier3dPhysicsTypeDocRepo } from '../types';

export class Rapier3dRaycastVehicleComponent
  extends Rapier3dRigidBodyComponent
  implements IRaycastVehicleComponent<Rapier3dPhysicsTypeDocRepo>
{
  protected _nativeVehicle: DynamicRayCastVehicleController | null = null;

  public get nativeVehicle(): DynamicRayCastVehicleController | null {
    return this._nativeVehicle;
  }

  private wheelDescr: [Vector3, Vector3, Vector3, number, number][] = [];

  constructor(
    protected readonly world: Rapier3dWorldComponent,
    private chassisBody: Rapier3dRigidBodyComponent,
  ) {
    super(world, ...chassisBody.factoryProps);
  }

  get wheelSpeed(): number {
    return (this.nativeVehicle?.currentVehicleSpeed() || 0) / 3.6;
  }

  addToWorld(
    world: Gg3dWorld<VisualTypeDocRepo3D, Rapier3dPhysicsTypeDocRepo, IVisualScene3dComponent, Rapier3dWorldComponent>,
  ) {
    super.addToWorld(world);
    this._nativeVehicle = world.physicsWorld.nativeWorld.createVehicleController(this._nativeBody!);
    this._nativeVehicle.indexUpAxis = 2;
    this._nativeVehicle.setIndexForwardAxis = 1;
    for (const descr of this.wheelDescr) {
      this._nativeVehicle.addWheel(...descr);
    }
    setInterval(() => this._nativeVehicle!.updateVehicle(0.01), 10);
  }

  removeFromWorld(
    world: Gg3dWorld<VisualTypeDocRepo3D, Rapier3dPhysicsTypeDocRepo, IVisualScene3dComponent, Rapier3dWorldComponent>,
  ) {
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
      new Vector3(options.position.x, options.position.y, options.position.z),
      Pnt3.nZ,
      options.isLeft ? Pnt3.X : Pnt3.nX,
      suspensionOptions.restLength,
      options.tyreRadius,
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
    if (!this.nativeVehicle) return;
    this.nativeVehicle.setWheelBrake(wheelIndex, force);
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

  clone(): Rapier3dRaycastVehicleComponent {
    return new Rapier3dRaycastVehicleComponent(this.world, this.chassisBody.clone());
  }

  dispose() {
    this.nativeVehicle?.free();
    super.dispose();
  }
}
