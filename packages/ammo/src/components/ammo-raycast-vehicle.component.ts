import {
  Gg3dWorld,
  IRaycastVehicleComponent,
  Point3,
  Point4,
  RaycastVehicle3dEntity,
  SuspensionOptions,
  VisualTypeDocRepo3D,
  WheelOptions,
} from '@gg-web-engine/core';
import Ammo from 'ammojs-typed';
import { AmmoRigidBodyComponent } from './ammo-rigid-body.component';
import { AmmoWorldComponent } from './ammo-world.component';
import { AmmoPhysicsTypeDocRepo } from '../types';

export class AmmoRaycastVehicleComponent
  extends AmmoRigidBodyComponent
  implements IRaycastVehicleComponent<AmmoPhysicsTypeDocRepo>
{
  public readonly nativeVehicle: Ammo.btRaycastVehicle;
  public readonly vehicleTuning: Ammo.btVehicleTuning = new Ammo.btVehicleTuning();
  protected readonly wheelDirectionCS0: Ammo.btVector3 = new Ammo.btVector3(0, 0, -1);
  protected readonly wheelAxleCS: Ammo.btVector3 = new Ammo.btVector3(1, 0, 0);

  public entity: RaycastVehicle3dEntity | null = null;

  constructor(protected readonly world: AmmoWorldComponent, public chassisBody: AmmoRigidBodyComponent) {
    super(world, chassisBody.nativeBody);
    this.nativeVehicle = new Ammo.btRaycastVehicle(
      this.vehicleTuning,
      this.chassisBody.nativeBody,
      new Ammo.btDefaultVehicleRaycaster(world.dynamicAmmoWorld!),
    );
    this.nativeVehicle.setCoordinateSystem(0, 2, 1);
  }

  get wheelSpeed(): number {
    // FIXME not correct (shows chassis speed in world)
    return this.nativeVehicle.getCurrentSpeedKmHour() / 3.6;
  }

  addToWorld(world: Gg3dWorld<VisualTypeDocRepo3D, AmmoPhysicsTypeDocRepo>) {
    if (world.physicsWorld != this.world) {
      throw new Error('Ammo raycast vehicle cannot be shared between different worlds');
    }
    // TODO parked cars can be deactivated until we start handling them. Needs explicit activation call
    this.chassisBody.nativeBody.setActivationState(4); // btCollisionObject::DISABLE_DEACTIVATION
    this.world.dynamicAmmoWorld?.addRigidBody(this.chassisBody.nativeBody);
    this.world.dynamicAmmoWorld!.addAction(this.nativeVehicle);
  }

  addWheel(options: WheelOptions, suspensionOptions: SuspensionOptions): void {
    const wheelInfo = this.nativeVehicle.addWheel(
      new Ammo.btVector3(options.position.x, options.position.y, options.position.z),
      this.wheelDirectionCS0,
      this.wheelAxleCS,
      suspensionOptions.restLength,
      options.tyreRadius,
      this.vehicleTuning,
      options.isFront,
    );
    wheelInfo.set_m_suspensionStiffness(suspensionOptions.stiffness);
    wheelInfo.set_m_wheelsDampingRelaxation(suspensionOptions.damping);
    wheelInfo.set_m_wheelsDampingCompression(suspensionOptions.compression);
    wheelInfo.set_m_frictionSlip(options.frictionSlip);
    wheelInfo.set_m_rollInfluence(options.rollInfluence);
    wheelInfo.set_m_maxSuspensionTravelCm(options.maxTravel * 100);
  }

  setSteering(wheelIndex: number, steering: number): void {
    this.nativeVehicle.setSteeringValue(steering, wheelIndex);
  }

  applyEngineForce(wheelIndex: number, force: number): void {
    this.nativeVehicle.applyEngineForce(force, wheelIndex);
  }

  applyBrake(wheelIndex: number, force: number): void {
    this.nativeVehicle.setBrake(force, wheelIndex);
  }

  isWheelTouchesGround(wheelIndex: number): boolean {
    return this.nativeVehicle.getWheelInfo(wheelIndex).get_m_raycastInfo().get_m_groundObject() > 0;
  }

  getWheelTransform(wheelIndex: number): { position: Point3; rotation: Point4 } {
    this.nativeVehicle.updateWheelTransform(wheelIndex, true);
    const transform = this.nativeVehicle.getWheelTransformWS(wheelIndex);
    const origin = transform.getOrigin();
    const quaternion = transform.getRotation();
    return {
      position: { x: origin.x(), y: origin.y(), z: origin.z() },
      rotation: { x: quaternion.x(), y: quaternion.y(), z: quaternion.z(), w: quaternion.w() },
    };
  }

  resetSuspension(): void {
    this.nativeVehicle.resetSuspension();
    for (let i = 0; i < this.nativeVehicle.getNumWheels(); i++) {
      this.nativeVehicle.updateWheelTransform(i, true);
    }
  }
}
