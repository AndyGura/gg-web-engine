import { Pnt3, Point3, Point4 } from '../../../base';
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
  /**
   * Tyre friction coefficient with the road (μ): the most sideways force a wheel holds is about
   * `frictionSlip` × the load on that wheel, so on flat ground the car corners at up to about
   * `frictionSlip` g before sliding. Street tyres are around 1.0-1.2; values far above that make
   * the car stick to the road like a train on rails.
   */
  frictionSlip: number;
  /**
   * Bullet's roll influence: the share (0..1) of the wheel's sideways force applied at the contact
   * point rather than at the chassis' centre of mass, so lower values make the car lean and roll
   * over less in a turn. Physics engines without this knob (Rapier) ignore it.
   */
  rollInfluence: number;
  /**
   * Multiplier on the tyre's sideways grip (default 1): below 1 the car slides out of turns
   * earlier, above 1 it holds the line harder. Physics engines without this knob (Ammo, whose side
   * grip follows `frictionSlip` alone) ignore it.
   */
  sideFrictionStiffness?: number;
  /**
   * How far the wheel can move up from its rest position, in meters (from `restLength` toward
   * the connection point `position`). A value above `SuspensionOptions.restLength` lets the wheel
   * center rise above its connection point, into the car body.
   */
  maxTravel: number;
  /**
   * The most force one wheel's suspension can push the chassis with, in Newtons. Beyond it the
   * spring stops getting stiffer, the suspension compresses to its travel limit, and the chassis
   * box hits the road. Defaults to {@link defaultMaxSuspensionForce} of the chassis mass.
   */
  maxSuspensionForce?: number;
};

/**
 * How a raycast vehicle's wheel touches the ground after the last `simulate()` step: what tyre
 * marks, squeal, smoke, surface-dependent grip and arcade assists read. See
 * `IRaycastVehicleComponent.getWheelContact`.
 *
 * @example
 * // skid marks: a wheel leaves a mark while it slides sideways faster than 1.5 m/s
 * const contact = car.raycastVehicle.vehicleComponent.getWheelContact(i);
 * if (contact && Math.abs(contact.sideSlipSpeed) > 1.5) {
 *   marks.addPoint(contact.point, contact.normal);
 * }
 */
export type WheelContact = {
  /** Where the wheel's suspension ray hits the ground, in world coordinates. */
  point: Point3;
  /** The ground's unit normal at `point`, in world coordinates. */
  normal: Point3;
  /**
   * The wheel's axle as a unit vector in world coordinates, steering included and laid into the
   * ground plane (perpendicular to `normal`): the direction the tyre's sideways grip pushes along.
   * It points to the car's right (`+X` of the chassis when the wheel is straight).
   */
  axle: Point3;
  /**
   * Velocity of the chassis at `point`, in m/s, from the chassis' linear and angular velocity (the
   * ground is taken as still). Its length is how fast the tyre's contact patch moves over the road,
   * for example the speed a locked wheel drags along at.
   */
  velocity: Point3;
  /**
   * `velocity` along `axle`, in m/s: how fast the wheel slides sideways over the ground, positive
   * toward the car's right. A raycast vehicle's wheels always roll with the ground, so this is the
   * slide that cornering beyond the grip, drifting or a side hit produce; the chassis bouncing or
   * rolling on its springs moves along `normal` and does not count.
   */
  sideSlipSpeed: number;
  /**
   * The force the wheel's suspension pushes the chassis up with, in Newtons: the wheel's share of
   * the car's weight plus whatever the bumps, braking and cornering add. The sum over all wheels
   * is about `mass × g` for a car standing still on flat ground (`bodyOptions.mass` is the mass),
   * and drops toward 0 as the car goes light over a crest. Never above the wheel's
   * `WheelOptions.maxSuspensionForce`: it is the force applied, after that limit.
   */
  suspensionForce: number;
  /**
   * The share of the grip the wheel needed that its friction gave in the last step: `1` while the
   * tyre holds, below `1` while it is over the grip and slides (Bullet's `m_skidInfo`). `null` on a
   * physics engine that does not report it (Rapier); use `sideSlipSpeed` there. The value comes
   * from the engine's own tyre model, so the same car slides at different values on different
   * engines.
   */
  skid: number | null;
};

/**
 * Default `WheelOptions.maxSuspensionForce` for a chassis of `chassisMass` kg: twice the full car
 * weight per wheel (2 × mass × 9.82 N), so it never limits a car on its wheels - braking,
 * cornering, dips and landings stay far below it - and only clamps a pathological spike. Physics
 * engines' own default of 6000 N per wheel holds a 1.5 t car only up to ~1.6 g.
 */
export const defaultMaxSuspensionForce = (chassisMass: number): number => 2 * chassisMass * 9.82;

/**
 * Builds a `WheelContact` from what a physics engine reports for one wheel. Every adapter's
 * `IRaycastVehicleComponent.getWheelContact` goes through it, so the fields derived here mean the
 * same on every engine. Every vector is in world coordinates and every input must describe the
 * chassis at one moment (an engine that casts the wheel rays before moving the chassis has to move
 * `point` along with the chassis first).
 *
 * - `axle`: chassis `+X` turned by `steering` (radians) about the chassis' up axis, rotated by
 *   `chassisRotation`, and projected onto the plane perpendicular to `normal` (the direction the
 *   engines' own tyre models apply the side grip along).
 * - `velocity`: `linearVelocity + angularVelocity × (point - centerOfMass)`.
 * - `suspensionForce`: clamped to `[0, maxSuspensionForce]`, as the engines do before applying it.
 */
export const buildWheelContact = (wheel: {
  point: Point3;
  normal: Point3;
  steering: number;
  chassisRotation: Point4;
  linearVelocity: Point3;
  angularVelocity: Point3;
  centerOfMass: Point3;
  suspensionForce: number;
  maxSuspensionForce: number;
  skid: number | null;
}): WheelContact => {
  const steeredAxle = Pnt3.rot(Pnt3.rotAround(Pnt3.X, Pnt3.Z, wheel.steering), wheel.chassisRotation);
  const inGroundPlane = Pnt3.sub(steeredAxle, Pnt3.scalarMult(wheel.normal, Pnt3.dot(steeredAxle, wheel.normal)));
  // an axle along the normal (a wheel on its side against a wall) has no ground-plane direction
  const axle = Pnt3.len(inGroundPlane) > 1e-6 ? Pnt3.norm(inGroundPlane) : steeredAxle;
  const velocity = Pnt3.add(
    wheel.linearVelocity,
    Pnt3.cross(wheel.angularVelocity, Pnt3.sub(wheel.point, wheel.centerOfMass)),
  );
  return {
    point: wheel.point,
    normal: wheel.normal,
    axle,
    velocity,
    sideSlipSpeed: Pnt3.dot(velocity, axle),
    suspensionForce: Math.min(Math.max(wheel.suspensionForce, 0), wheel.maxSuspensionForce),
    skid: wheel.skid,
  };
};

export interface IRaycastVehicleComponent<
  PTypeDoc extends PhysicsTypeDocRepo3D = PhysicsTypeDocRepo3D,
> extends IRigidBody3dComponent<PTypeDoc> {
  /** Return speed in m/s, calculated by car itself (which should be shown on the speedometer) */
  get wheelSpeed(): number;

  addWheel(options: WheelOptions, suspensionOptions: SuspensionOptions): void;

  /** Set steering value for wheel. The unit of steering is radian */
  setSteering(wheelIndex: number, steering: number): void;

  /**
   * Drive force of the wheel, in Newtons, pushing the chassis forward (negative: backward) at
   * the wheel's contact point. It stays applied until changed. The same value accelerates the car
   * equally at any frame rate.
   */
  applyEngineForce(wheelIndex: number, force: number): void;

  /**
   * Brake force of the wheel, in Newtons: the most force the wheel's braking can oppose its
   * rolling with (it holds a car still rather than pushing it backward). It stays applied until
   * changed, and it has no effect while the wheel's engine force isn't `0`. The same value
   * decelerates the car equally at any frame rate: physics engines take a brake as the impulse of
   * one internal step, so the adapter converts the force with the length of every step it runs.
   */
  applyBrake(wheelIndex: number, force: number): void;

  /**
   * Changes a wheel's `WheelOptions.frictionSlip` (tyre friction coefficient) on the live vehicle -
   * a handbrake that lets the rear tyres slide, a car crossing onto gravel or ice, a tyre
   * compound change. Takes effect from the next `simulate()` step on.
   */
  setWheelFrictionSlip(wheelIndex: number, frictionSlip: number): void;

  /** The wheel's current `WheelOptions.frictionSlip` (see `setWheelFrictionSlip`). */
  getWheelFrictionSlip(wheelIndex: number): number;

  isWheelTouchesGround(wheelIndex: number): boolean;

  /**
   * Where and how the wheel touches the ground after the last `simulate()` step, or `null` while
   * it does not (it is in the air, or `wheelIndex` is not a wheel). See `WheelContact`.
   */
  getWheelContact(wheelIndex: number): WheelContact | null;

  getWheelTransform(wheelIndex: number): {
    position: Point3;
    rotation: Point4;
  };

  resetSuspension(): void;

  clone(): IRaycastVehicleComponent;
}
