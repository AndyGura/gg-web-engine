import { Observable, Subject, takeUntil } from 'rxjs';
import { AxisDirection3, Box, CollisionEvent, IEntity, Pnt3, Point3, Point4, Qtrn } from '../../base';
import { Entity3d } from './entity-3d';
import { IDisplayObject3dComponent } from '../components/rendering/i-display-object-3d.component';
import {
  IRaycastVehicleComponent,
  SuspensionOptions,
  WheelOptions,
} from '../components/physics/i-raycast-vehicle.component';
import { IRigidBody3dComponent } from '../components/physics/i-rigid-body-3d.component';
import { IPositionable3d } from '../interfaces/i-positionable-3d';
import { Gg3dWorld, Gg3dWorldTypeDocRepo } from '../gg-3d-world';

export type WheelDisplayOptions = {
  displayObject?: IDisplayObject3dComponent;
  wheelObjectDirection?: AxisDirection3;
  autoScaleMesh?: boolean;
};

/**
 * Wheel settings shared by several wheels. Anything left out takes the default: `tyreWidth` 0.3,
 * `tyreRadius` 0.4, `frictionSlip` 1.2 (street tyres - see `WheelOptions.frictionSlip`),
 * `rollInfluence` 0.2, `sideFrictionStiffness` 1, `maxTravel` equal to `suspension.restLength` (the wheel compresses at most
 * up to its connection point), `maxSuspensionForce` per `defaultMaxSuspensionForce`.
 */
export type RVEntitySharedWheelOptions = {
  tyreWidth?: number;
  tyreRadius?: number;
  frictionSlip?: number;
  rollInfluence?: number;
  sideFrictionStiffness?: number;
  maxTravel?: number;
  maxSuspensionForce?: number;
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

/**
 * A hit of a raycast vehicle's chassis against another rigid body, emitted by
 * `RaycastVehicle3dEntity.impact$`: what hit sounds, damage, camera shake and sparks read.
 */
export type RaycastVehicleImpact<TypeDoc extends Gg3dWorldTypeDocRepo = Gg3dWorldTypeDocRepo> = {
  /** The entity owning `otherBody`, or `null` when it has none. */
  entity: (IEntity<Point3, Point4> & IPositionable3d) | null;
  /** The body the chassis hit. */
  otherBody: TypeDoc['pTypeDoc']['rigidBody'];
  /**
   * How fast the chassis and the other body came together along `normal`, in m/s, before the
   * physics step that started the contact resolved it (never negative). See `impact$` for where
   * each body's velocity comes from.
   */
  speed: number;
  /** World-space point of contact. */
  position: Point3;
  /** Contact normal at `position`, pointing away from the vehicle towards `otherBody`. */
  normal: Point3;
  /** The physics adapter's collision impulse - see `CollisionEvent.impulse` (only comparable within one adapter). */
  impulse: number;
  /**
   * `true` on the second of the two events a hit between two raycast vehicles produces (each
   * vehicle reports the hit, with the same `speed`): a pair-wide reaction (one crash sound, one
   * burst of sparks) skips mirrored events, a per-car one (damage, camera shake) takes them all.
   * Always `false` for a hit on anything that is not a `RaycastVehicle3dEntity`.
   */
  mirrored: boolean;
};

/** A raycast vehicle's touchdown after being airborne, emitted by `RaycastVehicle3dEntity.landed$`. */
export type RaycastVehicleLanding = {
  /**
   * How fast the chassis came down into the ground, in m/s (never negative): its velocity before
   * the physics step that put the wheels back on the ground, along the ground normal under the
   * wheels that touched down. On flat ground, the downward speed.
   */
  speed: number;
  /** How long every wheel was off the ground, in milliseconds of world time (at least `airborneDelay`). */
  airTime: number;
};

/**
 * One wheel's settings as `RaycastVehicle3dEntity` resolved them: the physics options handed to
 * the vehicle component (shared and per-axle settings merged over the defaults) plus the merged
 * display settings - what `RaycastVehicle3dEntity.createWheelEntity` is given.
 */
export type RVEntityWheelFullOptions = WheelOptions & { display: WheelDisplayOptions };

/**
 * What `RaycastVehicle3dEntity.createWheelEntity` returns for a wheel that is shown: the entity
 * the vehicle places at the wheel's transform every tick, and a rotation combined onto that
 * transform first (to turn a wheel mesh modelled along another axis, or for the other side of the
 * car), `null` for none.
 */
export type RVEntityWheelEntity<TypeDoc extends Gg3dWorldTypeDocRepo = Gg3dWorldTypeDocRepo> = {
  entity: Entity3d<TypeDoc>;
  localRotation: Point4 | null;
};

// see RVEntitySharedWheelOptions; maxTravel's default depends on the suspension, so it's filled in
// the constructor
const wheelDefaults = {
  tyreWidth: 0.3,
  tyreRadius: 0.4,
  frictionSlip: 1.2,
  rollInfluence: 0.2,
};

/**
 * A raycast vehicle: a chassis rigid body whose wheels are rays with simulated suspension, from
 * the physics adapter's own vehicle implementation. It has no engine or gearbox - apply forces per
 * axle with `applyTraction`/`applyBrake` (Newtons per wheel) and set `steeringAngle` (radians), or
 * use `GgCarEntity`, which adds a full drivetrain on top. Local axes: +X right, +Y forward, +Z up.
 * Suspension and tyre grip are simulated differently by each physics adapter, so tune the wheel
 * options on the backend you ship.
 *
 * @example
 * ```ts
 * import { RaycastVehicle3dEntity, RVEntityTractionBias } from '@gg-web-engine/core';
 *
 * const chassisSize = { x: 1.8, y: 4, z: 0.6 }; // 1.8 m wide, 4 m long (+Y is forward)
 * const vehicle = new RaycastVehicle3dEntity(
 *   {
 *     suspension: { stiffness: 20, damping: 2.3, compression: 4.4, restLength: 0.6 },
 *     tractionBias: RVEntityTractionBias.RWD,
 *     wheelBase: {
 *       shared: { tyreRadius: 0.4, tyreWidth: 0.3 },
 *       front: { halfAxleWidth: 1, axlePosition: 1.7, axleHeight: 0.3 },
 *       rear: { halfAxleWidth: 1, axlePosition: -1, axleHeight: 0.3 },
 *     },
 *   },
 *   world.visualScene.factory.createBox(chassisSize, { color: 0xcc0000 }),
 *   world.physicsWorld.factory.createRaycastVehicle(
 *     world.physicsWorld.factory.createRigidBody({ shape: { shape: 'BOX', dimensions: chassisSize }, body: { mass: 800 } }),
 *   ),
 * );
 * vehicle.position = { x: 0, y: 0, z: 2 };
 * world.addEntity(vehicle);
 *
 * // every tick, e.g. from your own input handling:
 * vehicle.applyTraction('rear', 2000);
 * vehicle.steeringAngle = 0.2;
 * console.log(vehicle.getSpeed() * 3.6, 'km/h');
 * ```
 */
export class RaycastVehicle3dEntity<
  TypeDoc extends Gg3dWorldTypeDocRepo = Gg3dWorldTypeDocRepo,
> extends Entity3d<TypeDoc> {
  static readonly entityTypeName: string = 'RaycastVehicle3dEntity';
  protected readonly wheels: (Entity3d<TypeDoc> | null)[] = [];
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

  /** Sets the engine force of every wheel of `axle`, in Newtons per wheel - see `IRaycastVehicleComponent.applyEngineForce`. */
  public applyTraction(axle: 'front' | 'rear' | 'both', force: number) {
    if (axle != 'rear') {
      this.frontWheelsIndices.forEach(index => this.vehicleComponent.applyEngineForce(index, force));
    }
    if (axle != 'front') {
      this.rearWheelsIndices.forEach(index => this.vehicleComponent.applyEngineForce(index, force));
    }
  }

  /** Sets the brake force of every wheel of `axle`, in Newtons per wheel - see `IRaycastVehicleComponent.applyBrake`. */
  public applyBrake(axle: 'front' | 'rear' | 'both', force: number) {
    if (axle != 'rear') {
      this.frontWheelsIndices.forEach(index => this.vehicleComponent.applyBrake(index, force));
    }
    if (axle != 'front') {
      this.rearWheelsIndices.forEach(index => this.vehicleComponent.applyBrake(index, force));
    }
  }

  /**
   * Sets the tyre friction coefficient of every wheel of `axle` - see
   * `IRaycastVehicleComponent.setWheelFrictionSlip`. Lets a handbrake or a surface change retune
   * grip without touching the physics backend.
   */
  public setFrictionSlip(axle: 'front' | 'rear' | 'both', frictionSlip: number) {
    if (axle != 'rear') {
      this.frontWheelsIndices.forEach(index => this.vehicleComponent.setWheelFrictionSlip(index, frictionSlip));
    }
    if (axle != 'front') {
      this.rearWheelsIndices.forEach(index => this.vehicleComponent.setWheelFrictionSlip(index, frictionSlip));
    }
  }

  /** How many wheels `axle` has (`'both'`: all wheels). */
  public wheelCount(axle: 'front' | 'rear' | 'both'): number {
    return (
      (axle != 'rear' ? this.frontWheelsIndices.length : 0) + (axle != 'front' ? this.rearWheelsIndices.length : 0)
    );
  }

  /**
   * How long, in milliseconds of world time, every wheel has to stay off the ground before the
   * vehicle counts as airborne (`airborne$`, `isAirborne`): long enough that a bump or a crest
   * lifting the wheels for a moment is not a jump. Default 250.
   */
  public airborneDelay: number = 250;

  private readonly _impact$: Subject<RaycastVehicleImpact<TypeDoc>> = new Subject<RaycastVehicleImpact<TypeDoc>>();
  private readonly _airborne$: Subject<void> = new Subject<void>();
  private readonly _landed$: Subject<RaycastVehicleLanding> = new Subject<RaycastVehicleLanding>();
  private _isAirborne: boolean = false;
  private _offGroundMs: number = 0;
  // the chassis velocities as of the end of the last tick: what the next physics step starts from
  private _velocityBeforeStep: Point3 = Pnt3.O;
  private _angularVelocityBeforeStep: Point3 = Pnt3.O;
  // vehicles this one reported a hit with in the current step, whose own report of it is still to
  // come (it is then `mirrored`) - cleared every tick
  private readonly _unmirroredImpacts: Set<RaycastVehicle3dEntity<any>> = new Set();

  /**
   * Fires once each time the chassis begins touching another rigid body (one event per body pair
   * and contact, whatever the shapes - see `IRigidBodyComponent.onCollisionStart`). `speed` is the
   * approach speed along the contact normal from the velocities before the physics step that
   * started the contact: this vehicle's as of the end of the previous tick (linear plus angular,
   * at the contact point), likewise for another `RaycastVehicle3dEntity`, and the current
   * velocity of any other body - exact for static and kinematic bodies, while a dynamic prop the
   * hit has already pushed reads its velocity after the step, so a light prop knocked away reads a
   * lower speed than the car hit it at. The collision event's own `relativeVelocity` is not used:
   * adapters read it after the contact resolved.
   *
   * Contacts of the wheels are not collisions (the wheels are rays) - see `landed$` for those. A
   * hard landing that bottoms the chassis out on the road fires both.
   *
   * @example
   * ```ts
   * car.raycastVehicle.impact$.subscribe(hit => {
   *   if (!hit.mirrored && hit.speed > 2) {
   *     playCrashSound(hit.position, hit.speed);
   *   }
   * });
   * ```
   */
  public get impact$(): Observable<RaycastVehicleImpact<TypeDoc>> {
    return this._impact$.asObservable();
  }

  /**
   * Fires when every wheel has been off the ground for `airborneDelay` ms of world time: the
   * vehicle jumped or fell (also when it lies on its side or roof).
   */
  public get airborne$(): Observable<void> {
    return this._airborne$.asObservable();
  }

  /**
   * Fires on the first tick a wheel touches the ground again after `airborne$`, with how fast the
   * chassis came down and how long it was in the air. A wheel leaving the ground for less than
   * `airborneDelay` fires neither. `resetTo` ends the airborne state without a landing.
   */
  public get landed$(): Observable<RaycastVehicleLanding> {
    return this._landed$.asObservable();
  }

  /** Whether the vehicle is airborne: every wheel off the ground for at least `airborneDelay` ms (see `airborne$`). */
  public get isAirborne(): boolean {
    return this._isAirborne;
  }

  /** car mesh and physics body direction has to be pointing: y front, z up*/
  constructor(
    public readonly carProperties: RVEntityProperties,
    public readonly chassis3D: IDisplayObject3dComponent | null,
    public readonly vehicleComponent: IRaycastVehicleComponent,
  ) {
    super({ object3D: chassis3D, objectBody: vehicleComponent });
    const withSuspensionDefaults = <T extends { maxTravel?: number }>(o: T): T & { maxTravel: number } => ({
      ...o,
      maxTravel: o.maxTravel ?? carProperties.suspension.restLength,
    });
    let wheelFullOptions: RVEntityWheelFullOptions[] =
      'wheelBase' in carProperties
        ? [
            carProperties.wheelBase.front,
            carProperties.wheelBase.front,
            carProperties.wheelBase.rear,
            carProperties.wheelBase.rear,
          ].map((a, i) =>
            withSuspensionDefaults({
              ...wheelDefaults,
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
            }),
          )
        : carProperties.wheelOptions.map((x, i) =>
            withSuspensionDefaults({
              ...wheelDefaults,
              ...(carProperties.sharedWheelOptions || {}),
              ...x,
              display: {
                ...(carProperties.sharedWheelOptions?.display || {}),
                ...(x.display || {}),
              },
            }),
          );
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
    wheelFullOptions.forEach((options, i) => {
      const wheel = this.createWheelEntity(options, i);
      if (!wheel) {
        this.wheels.push(null);
        this.wheelLocalRotation.push(null);
        return;
      }
      wheel.entity.name = this.name + '__wheel_' + (options.isFront ? 'f' : 'r') + (options.isLeft ? 'l' : 'r');
      this.wheels.push(wheel.entity);
      this.wheelLocalRotation.push(wheel.localRotation);
    });
    this.addChildren(...(this.wheels.filter(x => !!x) as (IEntity & IPositionable3d)[]));
    this.vehicleComponent.entity = this;
  }

  /**
   * Builds the entity that shows wheel `index`, or returns `null` for a wheel shown by nothing.
   * The vehicle names it (`<vehicle name>__wheel_<f|r><l|r>`, kept in step when the vehicle is
   * renamed), adds it as a child and moves it to the wheel's transform from the physics adapter
   * every tick (after `localRotation`). The default clones `options.display.displayObject` (none:
   * `null`), scaled to the tyre with `autoScaleMesh` and turned per `wheelObjectDirection` and the
   * side of the car.
   *
   * Override it for wheels of your own - an empty node whose transform a mesh controller reads, a
   * wheel entity class with behaviour of its own. It runs from the constructor, once per wheel in
   * order, before the subclass's own constructor body and field initializers: read only
   * `options`/`index` (and what the base class has set up), not the subclass's own fields.
   * @param options - The wheel's resolved settings
   * @param index - The wheel's index in the vehicle component (the order the wheels were added in)
   *
   * @example
   * ```ts
   * class MarkerWheelsVehicle extends RaycastVehicle3dEntity {
   *   // an empty node per wheel (`emptyNode()`: an empty display object of your visual adapter),
   *   // whose transform the game's own car model reads to place its wheel meshes
   *   protected createWheelEntity(): RVEntityWheelEntity {
   *     return { entity: new Entity3d({ object3D: emptyNode() }), localRotation: null };
   *   }
   * }
   * ```
   */
  protected createWheelEntity(options: RVEntityWheelFullOptions, index: number): RVEntityWheelEntity<TypeDoc> | null {
    const display = options.display || {};
    if (!display.displayObject) {
      return null;
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
    return { entity: new Entity3d<TypeDoc>({ object3D: displayObj }), localRotation };
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
    this.resetMotionTracking();
  }

  onSpawned(world: Gg3dWorld<TypeDoc>) {
    super.onSpawned(world);
    this.resetMotionTracking();
    // until removed: an entity may be removed from the world and added again
    this.vehicleComponent.onCollisionStart
      .pipe(takeUntil(this._onRemoved$))
      .subscribe(event => this.reportImpact(event));
    // after the transform binding (subscribed in the constructor), i.e. after the physics step
    this.tick$.pipe(takeUntil(this._onRemoved$)).subscribe(([_, delta]) => {
      this.updateAirborne(delta);
      this._unmirroredImpacts.clear();
      this.sampleVelocities();
    });
  }

  dispose(): void {
    super.dispose();
    this._impact$.complete();
    this._airborne$.complete();
    this._landed$.complete();
  }

  /** Forgets the airborne state and pending impacts, and samples the chassis velocities anew. */
  protected resetMotionTracking(): void {
    this._isAirborne = false;
    this._offGroundMs = 0;
    this._unmirroredImpacts.clear();
    this.sampleVelocities();
  }

  private sampleVelocities(): void {
    this._velocityBeforeStep = this.vehicleComponent.linearVelocity;
    this._angularVelocityBeforeStep = this.vehicleComponent.angularVelocity;
  }

  /** Velocity of the chassis at world point `point` before the current physics step. */
  private pointVelocityBeforeStep(point: Point3): Point3 {
    return Pnt3.add(
      this._velocityBeforeStep,
      Pnt3.cross(this._angularVelocityBeforeStep, Pnt3.sub(point, this.position)),
    );
  }

  private reportImpact(event: CollisionEvent<Point3, IRigidBody3dComponent>): void {
    const other = event.otherBody;
    const entity = other.entity;
    const otherVehicle = entity instanceof RaycastVehicle3dEntity && entity !== this ? entity : null;
    const otherVelocity = otherVehicle
      ? otherVehicle.pointVelocityBeforeStep(event.position)
      : Pnt3.add(other.linearVelocity, Pnt3.cross(other.angularVelocity, Pnt3.sub(event.position, other.position)));
    const speed = Math.max(
      0,
      Pnt3.dot(Pnt3.sub(this.pointVelocityBeforeStep(event.position), otherVelocity), event.normal),
    );
    let mirrored = false;
    if (otherVehicle) {
      mirrored = otherVehicle._unmirroredImpacts.delete(this);
      if (!mirrored) {
        this._unmirroredImpacts.add(otherVehicle);
      }
    }
    this._impact$.next({
      entity: (entity ?? null) as (IEntity<Point3, Point4> & IPositionable3d) | null,
      otherBody: other as TypeDoc['pTypeDoc']['rigidBody'],
      speed,
      position: event.position,
      normal: event.normal,
      impulse: event.impulse,
      mirrored,
    });
  }

  private updateAirborne(delta: number): void {
    const wheelCount = this.wheelCount('both');
    if (wheelCount === 0) {
      return;
    }
    let groundNormal = Pnt3.O;
    let touching = false;
    for (let i = 0; i < wheelCount; i++) {
      if (this.vehicleComponent.isWheelTouchesGround(i)) {
        touching = true;
        const contact = this.vehicleComponent.getWheelContact(i);
        if (contact) {
          groundNormal = Pnt3.add(groundNormal, contact.normal);
        }
      }
    }
    if (!touching) {
      this._offGroundMs += delta;
      // tolerance: 15 ticks of 1000 / 60 ms add up to just under 250
      if (!this._isAirborne && this._offGroundMs >= this.airborneDelay - 1e-6) {
        this._isAirborne = true;
        this._airborne$.next();
      }
      return;
    }
    if (this._isAirborne) {
      this._isAirborne = false;
      const normal = Pnt3.len(groundNormal) > 1e-6 ? Pnt3.norm(groundNormal) : Pnt3.Z;
      this._landed$.next({
        speed: Math.max(0, -Pnt3.dot(this._velocityBeforeStep, normal)),
        airTime: this._offGroundMs,
      });
    }
    this._offGroundMs = 0;
  }
}
