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
 * Default `WheelOptions.maxSuspensionForce` for a chassis of `chassisMass` kg: twice the full car
 * weight per wheel (2 × mass × 9.82 N), so it never limits a car on its wheels - braking,
 * cornering, dips and landings stay far below it - and only clamps a pathological spike. Physics
 * engines' own default of 6000 N per wheel holds a 1.5 t car only up to ~1.6 g.
 */
export const defaultMaxSuspensionForce = (chassisMass: number): number => 2 * chassisMass * 9.82;

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

  isWheelTouchesGround(wheelIndex: number): boolean;

  getWheelTransform(wheelIndex: number): {
    position: Point3;
    rotation: Point4;
  };

  resetSuspension(): void;

  clone(): IRaycastVehicleComponent;
}
