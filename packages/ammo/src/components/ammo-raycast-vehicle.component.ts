import {
  BitMask,
  buildWheelContact,
  CollisionGroup,
  defaultMaxSuspensionForce,
  IRaycastVehicleComponent,
  Point3,
  Point4,
  RaycastVehicle3dEntity,
  SuspensionOptions,
  WheelContact,
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

  /** Brake force of every wheel, in Newtons - see `applyBrake()`. */
  protected readonly brakeForces: number[] = [];

  /** Steering of every wheel as last set, and as the last step used it - see `prepareStep()`. */
  protected readonly steering: number[] = [];
  protected readonly stepSteering: number[] = [];

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
      throw new Error(
        "Ammo raycast vehicle cannot be shared between different worlds: this one was created by another world's factory. " +
          'Create it with the factory of the world it is added to (`world.physicsWorld.factory`).',
      );
    }
    this.addedToWorld = true;
    this.clearWheelContacts();
    // TODO parked cars can be deactivated until we start handling them. Needs explicit activation call
    this.chassisBody.nativeBody.setActivationState(4); // btCollisionObject::DISABLE_DEACTIVATION
    this.chassisBody.addToWorld(world);
    this.world.dynamicAmmoWorld!.addAction(this.nativeVehicle);
    this.world.raycastVehicles.add(this);
    this.world.added$.next(this);
  }

  removeFromWorld(world: AmmoGgWorld, dispose?: boolean) {
    this.addedToWorld = false;
    this.chassisBody.removeFromWorld(world);
    this.world.dynamicAmmoWorld!.removeAction(this.nativeVehicle);
    this.world.raycastVehicles.delete(this);
    this.world.removed$.next(this);
    if (dispose) {
      this.dispose();
    }
  }

  dispose(): void {
    // each of these is its own native allocation, freed independently of `nativeBody` (freed by
    // `super.dispose()`, shared with `chassisBody` - see this class's own doc) - guarded the same
    // defensive way every other Ammo component's dispose() guards its own handle(s), so one
    // already-freed handle (e.g. a caller disposing this entity twice) doesn't stop the rest from
    // being freed
    for (const handle of [
      this.nativeVehicle,
      this.vehicleTuning,
      this.raycaster,
      this.wheelDirectionCS0,
      this.wheelAxleCS,
    ]) {
      try {
        Ammo.destroy(handle);
      } catch {
        // pass
      }
    }
    super.dispose();
  }

  addWheel(options: WheelOptions, suspensionOptions: SuspensionOptions): void {
    const connectionPoint = new Ammo.btVector3(options.position.x, options.position.y, options.position.z);
    const wheelInfo = this.nativeVehicle.addWheel(
      connectionPoint,
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
    wheelInfo.set_m_maxSuspensionForce(
      options.maxSuspensionForce ?? defaultMaxSuspensionForce(this.chassisBody.nativeBody.getMass()),
    );
    // copied into the wheel by addWheel
    Ammo.destroy(connectionPoint);
    this.brakeForces.push(0);
    this.steering.push(0);
    this.stepSteering.push(0);
  }

  setWheelFrictionSlip(wheelIndex: number, frictionSlip: number): void {
    this.nativeVehicle.getWheelInfo(wheelIndex).set_m_frictionSlip(frictionSlip);
  }

  getWheelFrictionSlip(wheelIndex: number): number {
    return this.nativeVehicle.getWheelInfo(wheelIndex).get_m_frictionSlip();
  }

  setSteering(wheelIndex: number, steering: number): void {
    this.nativeVehicle.setSteeringValue(steering, wheelIndex);
    if (wheelIndex >= 0 && wheelIndex < this.steering.length) {
      this.steering[wheelIndex] = steering;
    }
  }

  applyEngineForce(wheelIndex: number, force: number): void {
    this.nativeVehicle.applyEngineForce(force, wheelIndex);
  }

  /**
   * Stores the brake force (Newtons); `AmmoWorldComponent.simulate()` hands it to Bullet before
   * every step - see `prepareStep()`.
   */
  applyBrake(wheelIndex: number, force: number): void {
    if (wheelIndex >= 0 && wheelIndex < this.brakeForces.length) {
      this.brakeForces[wheelIndex] = force;
    }
  }

  /**
   * Called by `AmmoWorldComponent.simulate()` right before `stepSimulation`, whose substeps all
   * have exactly `subStepLength` seconds.
   *
   * Records the steering the step uses, for `getWheelContact`'s axle: steering set after the step
   * must not turn the axle of a contact the step produced with the old steering.
   *
   * Converts every wheel's brake force into what Bullet's `setBrake` takes: the maximum impulse the
   * wheel's braking may apply in one internal substep (`btRaycastVehicle::updateFriction`
   * clamps the wheel's rolling impulse to `m_brake`), i.e. `force × substep length`. Passing the
   * force through unconverted brakes harder the shorter the substeps are, which is the case at a
   * higher frame rate (`AmmoWorldComponent.simulate()` splits each frame into substeps of 5-10 ms
   * depending on the frame's length): a 1.5 t car braked at 3.4 g at 50 FPS and 5 g at 144 FPS
   * with the same values.
   */
  prepareStep(subStepLength: number): void {
    for (let i = 0; i < this.brakeForces.length; i++) {
      this.nativeVehicle.setBrake(this.brakeForces[i] * subStepLength, i);
      this.stepSteering[i] = this.steering[i];
    }
  }

  /**
   * Clears every wheel's `m_groundObject`, which only Bullet's `rayCast` otherwise writes: after an
   * add or a `resetSuspension()`, the wheels report no ground until the next step instead of the
   * contact of the last step, wherever the chassis has been moved since.
   */
  private clearWheelContacts(): void {
    for (let i = 0; i < this.nativeVehicle.getNumWheels(); i++) {
      this.nativeVehicle.getWheelInfo(i).get_m_raycastInfo().set_m_groundObject(0);
    }
  }

  /**
   * `m_groundObject` of the last step's ray (cleared on add and by `resetSuspension()`, see
   * `clearWheelContacts`). A removed vehicle reports no ground without reading `nativeVehicle`,
   * which `removeFromWorld(world, true)` has freed.
   */
  isWheelTouchesGround(wheelIndex: number): boolean {
    return (
      this.addedToWorld && this.nativeVehicle.getWheelInfo(wheelIndex).get_m_raycastInfo().get_m_groundObject() > 0
    );
  }

  /**
   * Reads the wheel's `m_raycastInfo` (contact point and normal), `m_wheelsSuspensionForce` and
   * `m_skidInfo`, all written by the last step, and the steering that step used (`stepSteering`).
   * Contact is `m_groundObject`, like `isWheelTouchesGround`, not `m_isInContact`:
   * `updateWheelTransform` (`getWheelTransform`, run by the entity every tick after the step) resets
   * that flag. Bullet updates the vehicle after integrating the chassis, so the contact and the
   * chassis' pose and velocities belong to the same moment.
   */
  getWheelContact(wheelIndex: number): WheelContact | null {
    // `addedToWorld` first: `removeFromWorld(world, true)` frees `nativeVehicle`
    if (!this.addedToWorld || wheelIndex < 0 || wheelIndex >= this.nativeVehicle.getNumWheels()) {
      return null;
    }
    const wheelInfo = this.nativeVehicle.getWheelInfo(wheelIndex);
    const raycastInfo = wheelInfo.get_m_raycastInfo();
    if (!(raycastInfo.get_m_groundObject() > 0)) {
      return null;
    }
    const p = raycastInfo.get_m_contactPointWS();
    const n = raycastInfo.get_m_contactNormalWS();
    // a rigid body's world transform is its centre of mass frame
    const transform = this.nativeBody.getWorldTransform();
    const c = transform.getOrigin();
    const q = transform.getRotation();
    return buildWheelContact({
      point: { x: p.x(), y: p.y(), z: p.z() },
      normal: { x: n.x(), y: n.y(), z: n.z() },
      // the wheel's axle in chassis space is +X (`wheelAxleCS`)
      steering: this.stepSteering[wheelIndex] ?? 0,
      chassisRotation: { x: q.x(), y: q.y(), z: q.z(), w: q.w() },
      linearVelocity: this.linearVelocity,
      angularVelocity: this.angularVelocity,
      centerOfMass: { x: c.x(), y: c.y(), z: c.z() },
      suspensionForce: wheelInfo.get_m_wheelsSuspensionForce(),
      maxSuspensionForce: wheelInfo.get_m_maxSuspensionForce(),
      skid: wheelInfo.get_m_skidInfo(),
    });
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

  /**
   * Also clears the wheels' contacts (`clearWheelContacts`): Bullet's `resetSuspension` keeps
   * `m_groundObject` and overwrites the contact normal, so after a teleport the wheels would report
   * the old ground with a made-up normal until the next step.
   */
  resetSuspension(): void {
    this.nativeVehicle.resetSuspension();
    for (let i = 0; i < this.nativeVehicle.getNumWheels(); i++) {
      this.nativeVehicle.updateWheelTransform(i, true);
    }
    this.clearWheelContacts();
  }

  public clone(): AmmoRaycastVehicleComponent {
    return new AmmoRaycastVehicleComponent(this.world, this.chassisBody.clone());
  }

  resetMotion() {
    super.resetMotion();
    // after the chassis motion state has the new pose, which the wheels are placed from
    this.resetSuspension();
  }
}
