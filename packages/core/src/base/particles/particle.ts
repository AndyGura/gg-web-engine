import { MutablePoint2, MutablePoint3, Point2, Point3 } from '../models/points';

/** The mutable vector type matching `D`: `MutablePoint3` for `Point3`, `MutablePoint2` for `Point2`. */
export type MutableParticleVector<D extends Point2 | Point3> = D extends Point3 ? MutablePoint3 : MutablePoint2;

/** Copies `source` into `target` in place: `x`/`y`, and `z` when `target` has one (a 3D vector). */
export function copyParticleVector(target: MutablePoint2 | MutablePoint3, source: Point2 | Point3): void {
  target.x = source.x;
  target.y = source.y;
  if ('z' in target) {
    target.z = (source as Point3).z ?? 0;
  }
}

/** A zero vector of the given dimension count. */
export function zeroParticleVector<D extends Point2 | Point3>(dimensions: 2 | 3): MutableParticleVector<D> {
  return (dimensions === 3 ? { x: 0, y: 0, z: 0 } : { x: 0, y: 0 }) as MutableParticleVector<D>;
}

/**
 * One particle of a `ParticleSimulation`. Particles are pooled: the simulation creates `capacity` of
 * them up front and reuses them, so an init/update callback must never keep a reference to one past
 * its death (check {@link alive}, or compare {@link serial}).
 *
 * Every duration is in seconds, every speed in world units per second. Vectors are live objects:
 * `p.position.z += 1` works, and assigning one (`p.position = somePoint`) copies its components, so
 * the assigned object can be reused by the caller freely.
 *
 * What gets drawn each frame is the particle's own value multiplied by the system's curve over the
 * normalized age (`sizeOverLife`, `opacityOverLife`) when one is set. An app reproducing an effect
 * literally can leave the curves unset and drive every field from the update callback instead.
 *
 * @template D - `Point3` in a 3D system, `Point2` in a 2D one
 * @template T - The type of {@link data}, the app's own per-particle state
 */
export class Particle<D extends Point2 | Point3 = Point3, T = any> {
  /** Whether this particle is currently simulated and drawn. */
  public alive: boolean = false;

  /**
   * Increases by one with every particle the simulation spawns: older particles have smaller values.
   * A reused pool slot gets a new serial, so `(particle, serial)` identifies one particle's life.
   */
  public serial: number = 0;

  private readonly _position: MutableParticleVector<D>;
  private readonly _velocity: MutableParticleVector<D>;
  private readonly _acceleration: MutableParticleVector<D>;
  private readonly _size: MutablePoint2 = { x: 1, y: 1 };

  /**
   * Position, in the space the system simulates in: world space by default, the emitter's own frame
   * for a system with `space: 'local'`.
   */
  public get position(): MutableParticleVector<D> {
    return this._position;
  }

  public set position(value: D) {
    copyParticleVector(this._position, value);
  }

  /** Velocity in units per second. */
  public get velocity(): MutableParticleVector<D> {
    return this._velocity;
  }

  public set velocity(value: D) {
    copyParticleVector(this._velocity, value);
  }

  /** This particle's own acceleration in units per second², added to the system's `gravity`. */
  public get acceleration(): MutableParticleVector<D> {
    return this._acceleration;
  }

  public set acceleration(value: D) {
    copyParticleVector(this._acceleration, value);
  }

  /**
   * Linear drag per second: every step multiplies the velocity by `exp(-drag * dt)`. A per-step
   * factor `k` of an original running at fixed steps of `dt` seconds is `drag = -ln(k) / dt`.
   */
  public drag: number = 0;

  /** Seconds since spawn. */
  public age: number = 0;

  /** Seconds this particle lives; it dies on the step its age reaches this. `Infinity`: until killed. */
  public lifetime: number = 1;

  /** How many simulation steps this particle has been through - an exact tick counter for fixed-step logic. */
  public steps: number = 0;

  /**
   * Sprite size in world units: `x` is the width, `y` the height, so a non-square sprite keeps its
   * aspect. Multiplied by the system's `sizeOverLife` curve when one is set.
   */
  public get size(): MutablePoint2 {
    return this._size;
  }

  public set size(value: Point2) {
    this._size.x = value.x;
    this._size.y = value.y;
  }

  /** Opacity from `0` to `1`. Multiplied by the system's `opacityOverLife` curve when one is set. */
  public opacity: number = 1;

  /** Rotation of the sprite in its own plane, radians, counter-clockwise as seen by the viewer. */
  public rotation: number = 0;

  /** Radians per second added to {@link rotation}. */
  public angularVelocity: number = 0;

  /** RGB color as `0xRRGGBB`, multiplied with the texture (`0xffffff`: untinted). */
  public tint: number = 0xffffff;

  /**
   * Index into the system's `frames` (the atlas regions) to draw. Overwritten every step while
   * {@link frameSequence} is set; set it directly (e.g. from the update callback) otherwise.
   */
  public frame: number = 0;

  /**
   * Frames to play over this particle's life, as indices into the system's `frames`. `null`: no
   * animation, {@link frame} is left alone.
   */
  public frameSequence: readonly number[] | null = null;

  /**
   * Seconds each frame of {@link frameSequence} is shown. `0`: the sequence is spread evenly over
   * the particle's lifetime.
   */
  public frameDuration: number = 0;

  /** Whether {@link frameSequence} starts over after its last frame, instead of holding it. */
  public frameLoop: boolean = false;

  /**
   * Four free numbers copied to the render buffers' `extra` array (`instanceExtra` in the three.js
   * adapter), for a custom material/shader. The built-in materials ignore them.
   */
  public readonly shaderData: [number, number, number, number] = [0, 0, 0, 0];

  /** The app's own per-particle state. Reset to `undefined` when the particle is spawned. */
  public data: T | undefined = undefined;

  /** @internal state at the start of the last step, for interpolated rendering */
  public readonly prevPosition: MutableParticleVector<D>;
  /** @internal */
  public prevAge: number = 0;
  /** @internal */
  public prevRotation: number = 0;
  /** @internal */
  public prevOpacity: number = 1;
  /** @internal */
  public readonly prevSize: MutablePoint2 = { x: 1, y: 1 };

  constructor(
    /** The particle's slot in the simulation's pool, `0` to `capacity - 1`. Stable while it is alive. */
    public readonly index: number,
    dimensions: 2 | 3,
  ) {
    this._position = zeroParticleVector<D>(dimensions);
    this._velocity = zeroParticleVector<D>(dimensions);
    this._acceleration = zeroParticleVector<D>(dimensions);
    this.prevPosition = zeroParticleVector<D>(dimensions);
  }

  /** Age divided by lifetime, from `0` (just spawned) to `1` (about to die). `0` for an endless particle. */
  public get normalizedAge(): number {
    return normalizedAge(this.age, this.lifetime);
  }

  /** Removes this particle; it is no longer drawn from the next render on. */
  public kill(): void {
    this.alive = false;
  }

  /** @internal remembers the current state as the start of the next interpolation interval */
  public savePrevious(): void {
    copyParticleVector(this.prevPosition, this._position);
    this.prevAge = this.age;
    this.prevRotation = this.rotation;
    this.prevOpacity = this.opacity;
    this.prevSize.x = this._size.x;
    this.prevSize.y = this._size.y;
  }
}

export function normalizedAge(age: number, lifetime: number): number {
  if (!(lifetime > 0) || !isFinite(lifetime)) {
    return 0;
  }
  return Math.min(1, Math.max(0, age / lifetime));
}
