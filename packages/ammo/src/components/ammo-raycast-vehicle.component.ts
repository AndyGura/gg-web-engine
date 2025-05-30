import {
  BitMask,
  CollisionGroup,
  IRaycastVehicleComponent,
  Point3,
  Point4,
  RaycastVehicle3dEntity,
  SuspensionOptions,
  WheelOptions,
} from '@gg-web-engine/core';
import Ammo from '../ammo.js/ammo';
import { AmmoRigidBodyComponent } from './ammo-rigid-body.component';
import { AmmoWorldComponent } from './ammo-world.component';
import { AmmoGgWorld, AmmoPhysicsTypeDocRepo } from '../types';

export class AmmoRaycastVehicleComponent
  extends AmmoRigidBodyComponent
  implements IRaycastVehicleComponent<AmmoPhysicsTypeDocRepo>
{
  public readonly nativeVehicle: Ammo.btRaycastVehicle;
  public readonly vehicleTuning: Ammo.btVehicleTuning = new Ammo.btVehicleTuning();
  protected readonly wheelDirectionCS0: Ammo.btVector3 = new Ammo.btVector3(0, 0, -1);
  protected readonly wheelAxleCS: Ammo.btVector3 = new Ammo.btVector3(1, 0, 0);

  public entity: RaycastVehicle3dEntity | null = null;
  protected readonly raycaster: Ammo.btDefaultVehicleRaycaster;

  get interactWithCollisionGroups(): ReadonlyArray<CollisionGroup> {
    return this.chassisBody.interactWithCollisionGroups;
  }

  set interactWithCollisionGroups(value: ReadonlyArray<CollisionGroup> | 'all') {
    if (this.chassisBody) {
      this.chassisBody.interactWithCollisionGroups = value;
      this.raycaster.set_m_collisionFilterMask(BitMask.pack(this.chassisBody.interactWithCollisionGroups, 16));
    }
  }

  get ownCollisionGroups(): ReadonlyArray<CollisionGroup> {
    return this.chassisBody.ownCollisionGroups;
  }

  set ownCollisionGroups(value: ReadonlyArray<CollisionGroup> | 'all') {
    if (this.chassisBody) {
      this.chassisBody.ownCollisionGroups = value;
      this.raycaster.set_m_collisionFilterGroup(BitMask.pack(this.chassisBody.ownCollisionGroups, 16));
    }
  }

  refreshCG() {
    this.chassisBody.refreshCG();
  }

  constructor(
    protected readonly world: AmmoWorldComponent,
    public chassisBody: AmmoRigidBodyComponent,
  ) {
    super(world, chassisBody.nativeBody, chassisBody.shape);
    this.raycaster = new Ammo.btDefaultVehicleRaycaster(world.dynamicAmmoWorld!);
    this.nativeVehicle = new Ammo.btRaycastVehicle(this.vehicleTuning, this.chassisBody.nativeBody, this.raycaster);
    this.raycaster.set_m_collisionFilterGroup(BitMask.pack(this.chassisBody.ownCollisionGroups, 16));
    this.raycaster.set_m_collisionFilterMask(BitMask.pack(this.chassisBody.interactWithCollisionGroups, 16));
    this.nativeVehicle.setCoordinateSystem(0, 2, 1);
  }

  get wheelSpeed(): number {
    // FIXME not correct (shows chassis speed in world)
    return this.nativeVehicle.getCurrentSpeedKmHour() / 3.6;
  }

  addToWorld(world: AmmoGgWorld) {
    if (world.physicsWorld != this.world) {
      throw new Error('Ammo raycast vehicle cannot be shared between different worlds');
    }
    this.addedToWorld = true;
    // TODO parked cars can be deactivated until we start handling them. Needs explicit activation call
    this.chassisBody.nativeBody.setActivationState(4); // btCollisionObject::DISABLE_DEACTIVATION
    this.chassisBody.addToWorld(world);
    this.world.dynamicAmmoWorld!.addAction(this.nativeVehicle);
    this.world.added$.next(this);
  }

  removeFromWorld(world: AmmoGgWorld) {
    this.addedToWorld = false;
    this.chassisBody.removeFromWorld(world);
    this.world.dynamicAmmoWorld!.removeAction(this.nativeVehicle);
    this.world.removed$.next(this);
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
    // Ammo.js provides wrong wheel rotation when using coordinate system `0, 2, 1`, but it is correct if set `0, 1, 2`
    this.nativeVehicle.setCoordinateSystem(0, 1, 2);
    // when interpolated transform set to `true`, wheels are jittering relatively to car on high speeds
    this.nativeVehicle.updateWheelTransform(wheelIndex, false);
    this.nativeVehicle.setCoordinateSystem(0, 2, 1);
    const transform = this.nativeVehicle.getWheelTransformWS(wheelIndex);
    const origin = transform.getOrigin();
    const quaternion = transform.getRotation();
    quaternion.normalize();
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

  public clone(): AmmoRaycastVehicleComponent {
    return new AmmoRaycastVehicleComponent(this.world, this.chassisBody.clone());
  }

  resetMotion() {
    this.resetSuspension();
    super.resetMotion();
  }
}
