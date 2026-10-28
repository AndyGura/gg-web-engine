import {
  buildWheelContact,
  CollisionGroup,
  defaultMaxSuspensionForce,
  Frame3d,
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
import { AmmoBodyComponent } from './ammo-body.component';
import { AmmoWorldComponent } from './ammo-world.component';
import { AmmoGgWorld, AmmoPhysicsTypeDocRepo } from '../types';

/**
 * A Bullet `btRaycastVehicle` on the native rigid body of `chassisBody`. The vehicle is the one
 * component of that native body in the world: it adds and removes the body itself, and
 * `chassisBody` (the component the vehicle was created from, sharing the same native body) is never
 * added to the world. Adding both would report two components for one body - twice in `children`
 * and `added$`/`removed$`, and a trigger's `onEntityLeft` for the component without an entity - so
 * collision and trigger events, `raycast()` hits and the native-body reverse map all resolve the
 * chassis to the vehicle. Use the vehicle, never `chassisBody`, once it is created.
 */
export class AmmoRaycastVehicleComponent
  extends AmmoRigidBodyComponent
  implements IRaycastVehicleComponent<AmmoPhysicsTypeDocRepo>
{
  public readonly nativeVehicle: Ammo.btRaycastVehicle;

  private static _sharedVehicleTuning: Ammo.btVehicleTuning | null = null;

  /**
   * One `btVehicleTuning` shared by every vehicle. Bullet only reads it inside the
   * `btRaycastVehicle` constructor and `addWheel` (which copies its values into the wheel), never
   * keeps a reference, and this Ammo build binds the class with `NoDelete`: it has no destructor
   * binding, so `Ammo.destroy` throws on it and an instance per vehicle could never be freed.
   */
  public readonly vehicleTuning: Ammo.btVehicleTuning = (AmmoRaycastVehicleComponent._sharedVehicleTuning ??=
    new Ammo.btVehicleTuning());
  protected readonly wheelDirectionCS0: Ammo.btVector3 = new Ammo.btVector3(0, 0, -1);
  protected readonly wheelAxleCS: Ammo.btVector3 = new Ammo.btVector3(1, 0, 0);

  public entity: RaycastVehicle3dEntity | null = null;
  protected readonly raycaster: Ammo.btDefaultVehicleRaycaster;

  /** Brake force of every wheel, in Newtons - see `applyBrake()`. */
  protected readonly brakeForces: number[] = [];

  /** Steering of every wheel as last set, and as the last step used it - see `prepareStep()`. */
  protected readonly steering: number[] = [];
  protected readonly stepSteering: number[] = [];

  /** Also sets the wheel rays' mask, and mirrors the groups onto `chassisBody`. */
  get interactWithCollisionGroups(): ReadonlyArray<CollisionGroup> {
    return super.interactWithCollisionGroups;
  }

  set interactWithCollisionGroups(value: ReadonlyArray<CollisionGroup> | 'all') {
    super.interactWithCollisionGroups = value;
    // the base constructor sets the default groups before `chassisBody`/`raycaster` exist
    if (this.chassisBody && this.raycaster) {
      this.chassisBody.interactWithCollisionGroups = value;
      this.raycaster.set_m_collisionFilterMask(this._interactWithCGsMask);
    }
  }

  /** Also sets the wheel rays' group, and mirrors the groups onto `chassisBody`. */
  get ownCollisionGroups(): ReadonlyArray<CollisionGroup> {
    return super.ownCollisionGroups;
  }

  set ownCollisionGroups(value: ReadonlyArray<CollisionGroup> | 'all') {
    super.ownCollisionGroups = value;
    if (this.chassisBody && this.raycaster) {
      this.chassisBody.ownCollisionGroups = value;
      this.raycaster.set_m_collisionFilterGroup(this._ownCGsMask);
    }
  }

  constructor(
    protected readonly world: AmmoWorldComponent,
    public chassisBody: AmmoRigidBodyComponent,
  ) {
    super(
      world,
      chassisBody.nativeBody,
      chassisBody.shape,
      chassisBody.bodyType,
      chassisBody.ccd,
      chassisBody.canSleep,
    );
    this.raycaster = new Ammo.btDefaultVehicleRaycaster(world.dynamicAmmoWorld!);
    this.nativeVehicle = new Ammo.btRaycastVehicle(this.vehicleTuning, this.chassisBody.nativeBody, this.raycaster);
    this.ownCollisionGroups = chassisBody.ownCollisionGroups;
    this.interactWithCollisionGroups = chassisBody.interactWithCollisionGroups;
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
    this.clearWheelContacts();
    // TODO parked cars can be deactivated until we start handling them. Needs explicit activation call
    this.nativeBody.setActivationState(4); // btCollisionObject::DISABLE_DEACTIVATION
    this.world.dynamicAmmoWorld!.addAction(this.nativeVehicle);
    this.world.raycastVehicles.add(this);
    // adds the shared native body and emits `added$` for this component only - see the class doc
    // for why `chassisBody` stays out of the world
    super.addToWorld(world);
  }

  removeFromWorld(world: AmmoGgWorld, dispose?: boolean) {
    this.world.dynamicAmmoWorld!.removeAction(this.nativeVehicle);
    this.world.raycastVehicles.delete(this);
    // removes the native body, emits `removed$` for this component only, then disposes if asked
    super.removeFromWorld(world, dispose);
  }

  dispose(): void {
    if (this.nativeDisposed) {
      return;
    }
    // `isWheelTouchesGround`/`getWheelContact` read `nativeVehicle` only while this is set
    this.addedToWorld = false;
    // each of these is its own native allocation, freed independently of `nativeBody` (freed by
    // `super.dispose()`, shared with `chassisBody` - see this class's own doc), each in its own
    // try/catch so one failing destroy doesn't stop the rest from being freed. `vehicleTuning` is
    // shared by every vehicle and never freed (see its doc). A second call returns above: a second
    // `Ammo.destroy` of the same object would free it again, it doesn't throw.
    for (const handle of [this.nativeVehicle, this.raycaster, this.wheelDirectionCS0, this.wheelAxleCS]) {
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

  /**
   * Bullet doesn't check a wheel index (its asserts are compiled out): an index past the wheels
   * reads and writes WASM memory outside `m_wheelInfo`. Every wheel method checks it here instead.
   */
  private hasWheel(wheelIndex: number): boolean {
    return wheelIndex >= 0 && wheelIndex < this.steering.length;
  }

  setWheelFrictionSlip(wheelIndex: number, frictionSlip: number): void {
    if (this.hasWheel(wheelIndex)) {
      this.nativeVehicle.getWheelInfo(wheelIndex).set_m_frictionSlip(frictionSlip);
    }
  }

  getWheelFrictionSlip(wheelIndex: number): number {
    return this.hasWheel(wheelIndex) ? this.nativeVehicle.getWheelInfo(wheelIndex).get_m_frictionSlip() : 0;
  }

  setSteering(wheelIndex: number, steering: number): void {
    if (this.hasWheel(wheelIndex)) {
      this.nativeVehicle.setSteeringValue(steering, wheelIndex);
      this.steering[wheelIndex] = steering;
    }
  }

  applyEngineForce(wheelIndex: number, force: number): void {
    if (this.hasWheel(wheelIndex)) {
      this.nativeVehicle.applyEngineForce(force, wheelIndex);
    }
  }

  /**
   * Stores the brake force (Newtons); `AmmoWorldComponent.simulate()` hands it to Bullet before
   * every step - see `prepareStep()`.
   */
  applyBrake(wheelIndex: number, force: number): void {
    if (this.hasWheel(wheelIndex)) {
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
      this.addedToWorld &&
      this.hasWheel(wheelIndex) &&
      this.nativeVehicle.getWheelInfo(wheelIndex).get_m_raycastInfo().get_m_groundObject() > 0
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
    if (!this.addedToWorld || !this.hasWheel(wheelIndex)) {
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
   * `IRigidBody3dComponent.onFrameSwitch`: the chassis as any rigid body, then the wheels. Bullet
   * recomputes every world-space wheel quantity from the chassis at the start of each step, so only
   * what is read between the switch and the next step needs moving: each wheel's transform
   * (recomputed from the moved chassis, as `getWheelTransform` does) and the last step's contact
   * point and normal (`getWheelContact`), moved by `delta`. Suspension length, wheel spin, steering,
   * engine and brake forces are local and stay; so does `m_groundObject`, since the ground moved
   * along.
   */
  public onFrameSwitch(delta: Frame3d): void {
    super.onFrameSwitch(delta);
    for (let i = 0; i < this.nativeVehicle.getNumWheels(); i++) {
      const raycastInfo = this.nativeVehicle.getWheelInfo(i).get_m_raycastInfo();
      const p = raycastInfo.get_m_contactPointWS();
      const point = delta.toGlobalPoint({ x: p.x(), y: p.y(), z: p.z() });
      raycastInfo.set_m_contactPointWS(AmmoBodyComponent.scratchVector(point.x, point.y, point.z));
      const n = raycastInfo.get_m_contactNormalWS();
      const normal = delta.toGlobalDirection({ x: n.x(), y: n.y(), z: n.z() });
      raycastInfo.set_m_contactNormalWS(AmmoBodyComponent.scratchVector(normal.x, normal.y, normal.z));
      this.getWheelTransform(i);
    }
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
