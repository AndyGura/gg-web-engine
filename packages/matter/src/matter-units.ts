import { Point2 } from '@gg-web-engine/core';
import { Body, Vector } from 'matter-js';

/**
 * The one conversion between this engine's world units and matter-js's native units.
 *
 * The engine measures every 2D world in meters, kilograms and seconds (positions and sizes in
 * meters, velocities in m/s, forces in N, torques in N·m, gravity in m/s²). matter-js's solver is
 * tuned for bodies tens to hundreds of native units across (its `slop` of 0.05, resting/sleeping
 * thresholds, the number of sides `Bodies.circle` approximates a circle with all assume that), so a
 * meter-sized body fed to it raw would be numerically bad. Every world-unit quantity crossing into or
 * out of matter-js is therefore converted at the adapter boundary through this module: lengths by
 * `MATTER_UNITS_PER_METER`, and velocities, forces, torques and gravity by the derived scales below,
 * which also fold in matter-js's own time base (it integrates per millisecond and reports velocities
 * per `Body._baseDelta` of 1000/60 ms). A `nativeBody` or the `matterEngine` is always in matter-js's
 * native units.
 */
export const MATTER_UNITS_PER_METER = 100;

/** matter-js's `Body._baseDelta`: `Body.getVelocity`/`getAngularVelocity` report per this many ms. */
const MATTER_BASE_DELTA_MS = 1000 / 60;

/**
 * matter-js's `Body._inertiaScale`: `Body.setMass`/`Body.setParts` set a body's native `inertia`
 * to this many times the physical moment of inertia of its vertices. Read off the library (with its
 * documented default as the fallback) so a torque in N·m spins a body by `τ / I` with `I` the
 * physical inertia in kg·m², whatever the library's internal scale.
 */
export const MATTER_INERTIA_SCALE = (Body as unknown as { _inertiaScale?: number })._inertiaScale ?? 4;

/** m/s -> native velocity (units per base step). */
export const MATTER_VELOCITY_SCALE = (MATTER_UNITS_PER_METER * MATTER_BASE_DELTA_MS) / 1000;

/** rad/s -> native angular velocity (radians per base step). */
export const MATTER_ANGULAR_VELOCITY_SCALE = MATTER_BASE_DELTA_MS / 1000;

/**
 * N -> native force. `Body.update` integrates `velocity += force / mass * dt²` with `dt` in
 * milliseconds and `velocity` in units per step, so a Newton (kg·m/s²) is
 * `MATTER_UNITS_PER_METER / 1000²` native force units: one update of `dt` ms then changes the
 * velocity by `F / m * dt` seconds' worth, as it should. Mass is kg on both sides.
 */
export const MATTER_FORCE_SCALE = MATTER_UNITS_PER_METER * 1e-6;

/**
 * N·m -> native torque. `Body.update` integrates `angularVelocity += torque / inertia * dt²`
 * against the native inertia (`MATTER_INERTIA_SCALE` times the physical inertia, in
 * kg·units²), so a torque that must give `τ / I` rad/s² is scaled by that factor and by units² on
 * top of the millisecond time base.
 */
export const MATTER_TORQUE_SCALE = MATTER_INERTIA_SCALE * MATTER_UNITS_PER_METER * MATTER_UNITS_PER_METER * 1e-6;

/** Native `body.inertia` -> kg·m² (the physical moment of inertia). */
export const MATTER_INERTIA_TO_SI = 1 / (MATTER_INERTIA_SCALE * MATTER_UNITS_PER_METER * MATTER_UNITS_PER_METER);

/**
 * `Engine.gravity.scale` for a `gravity.x`/`gravity.y` given in m/s². `Engine.update` adds
 * `mass * gravity * scale` to each body's force every step, so this is `MATTER_FORCE_SCALE`: the
 * same conversion as for any other force in N per kg.
 */
export const MATTER_GRAVITY_SCALE = MATTER_FORCE_SCALE;

export function toMatterLength(meters: number): number {
  return meters * MATTER_UNITS_PER_METER;
}

export function fromMatterLength(units: number): number {
  return units / MATTER_UNITS_PER_METER;
}

export function toMatterPoint(point: Point2): Vector {
  return Vector.create(point.x * MATTER_UNITS_PER_METER, point.y * MATTER_UNITS_PER_METER);
}

export function fromMatterPoint(vector: Vector): Point2 {
  return { x: vector.x / MATTER_UNITS_PER_METER, y: vector.y / MATTER_UNITS_PER_METER };
}
