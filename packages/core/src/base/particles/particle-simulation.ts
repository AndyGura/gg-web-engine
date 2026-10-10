import { Point2, Point3 } from '../models/points';
import { copyParticleVector, MutableParticleVector, normalizedAge, Particle, zeroParticleVector } from './particle';
import { evaluateParticleCurve, ParticleCurve } from './particle-curve';
import { FULL_PARTICLE_FRAME, ParticleFrame } from './particle-frames';
import { createParticleRenderBuffers, ParticleRenderBuffers } from './particle-render';

/** Tolerance for comparing accumulated step times, so `n` steps of `1/30` reach a lifetime of `n/30`. */
const TIME_EPSILON = 1e-7;

/**
 * Where particles spawn: maps points and directions given in the emitter's own frame into the space
 * the particles live in. The entity owning a simulation provides it (from its position, rotation,
 * and the entity it is attached to).
 */
export interface ParticleEmitterTransform<D extends Point2 | Point3> {
  /** An emitter-local point in simulation space. */
  pointToSim(local: D): MutableParticleVector<D>;
  /** An emitter-local direction in simulation space (rotated, not moved). */
  directionToSim(local: D): MutableParticleVector<D>;
}

/** What an init callback gets besides the particle. */
export interface ParticleEmitContext<D extends Point2 | Point3> {
  /** This particle's number within the current emission, `0` to `count - 1`. */
  readonly index: number;
  /** How many particles the current emission asked for. */
  readonly count: number;
  /** The emitter's origin in simulation space - also where the particle was placed before the callback. */
  readonly origin: D;
  /** The simulation's time in seconds (see `ParticleSimulation.time`). */
  readonly time: number;
  /** An emitter-local point in simulation space, e.g. a wheel's offset on a car the emitter is attached to. */
  pointToSim(local: D): MutableParticleVector<D>;
  /** An emitter-local direction in simulation space, e.g. "backwards" on that car. */
  directionToSim(local: D): MutableParticleVector<D>;
  /** The simulation's random source, a number in `[0, 1)`. */
  random(): number;
  /** A random number in `[min, max)`. */
  range(min: number, max: number): number;
}

/** Sets up a spawned particle: position, velocity, size, lifetime, user data, ... */
export type ParticleInit<D extends Point2 | Point3 = Point3, T = any> = (
  particle: Particle<D, T>,
  context: ParticleEmitContext<D>,
) => void;

/**
 * Runs for every live particle on every simulation step, after the built-in motion, aging and frame
 * animation. May change any field, or `kill()` the particle. `dt` is the step in seconds.
 */
export type ParticleUpdate<D extends Point2 | Point3 = Point3, T = any> = (
  particle: Particle<D, T>,
  dt: number,
  simulation: ParticleSimulation<D, T>,
) => void;

/**
 * A repeated burst: `count` particles at `time` seconds of simulation time, then every `interval`
 * seconds, `cycles` times in all.
 */
export type ParticleBurst = {
  readonly time: number;
  readonly count: number;
  /** Seconds between cycles. Default `0`: the cycles all fire at once (an infinite burst then fires once). */
  readonly interval?: number;
  /** How many times the burst fires. Default `1`; `Infinity` repeats forever (with a positive `interval`). */
  readonly cycles?: number;
};

/**
 * What a particle system simulates and how. Every duration is in seconds and every speed in world
 * units per second (unlike the world's own `fixedPhysicsStep`, which is in milliseconds). Fields
 * marked "live" are read on every step, so changing them on `simulation.options` takes effect at
 * once; the others apply to particles spawned afterwards.
 * @template D - `Point3` in a 3D system, `Point2` in a 2D one
 * @template T - The type of `Particle.data`
 */
export type ParticleSimulationOptions<D extends Point2 | Point3 = Point3, T = any> = {
  /**
   * What happens when a particle is spawned while `capacity` are alive: `'replace-oldest'` (default)
   * reuses the oldest live particle, `'drop'` spawns nothing.
   */
  overflow?: 'replace-oldest' | 'drop';
  /**
   * `'world'` (default): particles live in world space, so they stay where they were emitted when the
   * emitter moves on - smoke left behind a car. `'local'`: positions, velocities and gravity are in
   * the emitter's own frame and the whole system moves and turns with it - a flame stuck to a car.
   */
  space?: 'world' | 'local';
  /** Live. Acceleration applied to every particle, units per second². Default none. */
  gravity?: D;
  /** Default `Particle.drag` of a spawned particle. Default `0`. */
  drag?: number;
  /** Default lifetime of a spawned particle in seconds: a number, or `[min, max]` for a random one. Default `1`. */
  lifetime?: number | readonly [number, number];
  /** Default size of a spawned particle in world units: a number for a square, or `{ x: width, y: height }`. Default `1`. */
  size?: number | Point2;
  /** Default opacity of a spawned particle. Default `1`. */
  opacity?: number;
  /** Default tint of a spawned particle, `0xRRGGBB`. Default `0xffffff`. */
  tint?: number;
  /** Live. The regions of the texture particles can show, indexed by `Particle.frame`. Default: the whole texture. */
  frames?: readonly ParticleFrame[];
  /** Default `Particle.frameSequence`. */
  frameSequence?: readonly number[] | null;
  /** Default `Particle.frameDuration`. */
  frameDuration?: number;
  /** Default `Particle.frameLoop`. */
  frameLoop?: boolean;
  /** Live. Multiplies the drawn size over the normalized age: one curve for both axes, or one per axis. */
  sizeOverLife?: ParticleCurve | { readonly x: ParticleCurve; readonly y: ParticleCurve };
  /** Live. Multiplies the drawn opacity over the normalized age. */
  opacityOverLife?: ParticleCurve;
  /**
   * Live. Runs for every spawned particle - continuous, burst, and `emit()` ones - after the
   * defaults above are applied and before the init passed to `emit()`.
   */
  init?: ParticleInit<D, T>;
  /** Live. Per-particle custom behaviour, see `ParticleUpdate`. */
  update?: ParticleUpdate<D, T>;
  /** Live. Particles spawned per second while `emitting`. Default `0`. */
  rate?: number;
  /** Bursts while `emitting`, timed by simulation time (see `ParticleSimulation.restart`). */
  bursts?: readonly ParticleBurst[];
  /** Whether `rate` and `bursts` spawn particles. Default `true`. `emit()` always works. */
  emitting?: boolean;
  /**
   * Live. Runs once per simulation step, after the live particles have moved, with the step in
   * seconds: emit here to spawn particles in lockstep with the simulation (with `fixedTimeStep`,
   * exactly like an original game's tick did).
   */
  onStep?: (dt: number, simulation: ParticleSimulation<D, T>) => void;
  /**
   * Simulate in fixed steps of this many seconds (e.g. `1 / 30` to mirror a 30 Hz original) instead
   * of one step per world tick. Leftover time carries over to the next tick. Default: off.
   */
  fixedTimeStep?: number;
  /** With `fixedTimeStep`: most steps per tick; time beyond them is dropped. Default `8`. */
  maxStepsPerTick?: number;
  /**
   * With `fixedTimeStep`: draw particles between their last two steps (position, size, opacity,
   * rotation and the curves' age), so a 30 Hz simulation moves smoothly on a faster display. `false`
   * shows each step's state as is, stepping like the original. Default `true`. Frames and tint are
   * never interpolated.
   */
  interpolate?: boolean;
  /** Random source in `[0, 1)` for every random choice of the simulation. Default `Math.random`. */
  random?: () => number;
};

type BurstState = { next: number; remaining: number };

/**
 * The dimension-agnostic particle simulation behind a particle system entity: a pool of `capacity`
 * particles, emission (manual, continuous, bursts), motion, aging, frame animation, curves, an
 * optional fixed step with interpolation, and writing the result into `ParticleRenderBuffers` for a
 * rendering adapter. It runs entirely in core, so a system behaves the same with every adapter.
 *
 * Order within one step: live particles age (a particle whose age reaches its lifetime dies), move
 * (`velocity += (gravity + acceleration) * dt`, `velocity *= exp(-drag * dt)`,
 * `position += velocity * dt`, `rotation += angularVelocity * dt`), advance their frame sequence and
 * run the `update` callback; then `onStep` runs and `rate`/`bursts` spawn. A particle spawned during
 * a step, or by `emit()` between steps, is drawn first in its initial state and first moves in the
 * next step.
 */
export class ParticleSimulation<D extends Point2 | Point3 = Point3, T = any> {
  public readonly buffers: ParticleRenderBuffers;

  /** Simulated seconds since creation or the last `restart()`. Burst times count from here. */
  public time: number = 0;

  /** Multiplies the time `advance` is given: `0.5` is slow motion, `0` freezes the particles. */
  public timeScale: number = 1;

  /** Whether `rate` and `bursts` spawn particles. */
  public emitting: boolean;

  /**
   * Maps emitter-local points/directions into simulation space; set by the entity owning the
   * simulation. Default: identity (the emitter at the origin).
   */
  public transform: ParticleEmitterTransform<D>;

  /** Where between the last two steps rendering is, `0` to `1` (always `1` without interpolation). */
  public get interpolationAlpha(): number {
    return this._alpha;
  }

  private readonly pool: Particle<D, T>[] = [];
  /** live particles in spawn order (oldest first); may contain dead ones until the next compaction */
  private live: Particle<D, T>[] = [];
  private free: Particle<D, T>[] = [];
  private readonly scratch: Particle<D, T>[] = [];
  /** the particle whose `update` callback is running, never recycled by an `emit()` from inside it */
  private updating: Particle<D, T> | null = null;
  private serialCounter = 0;
  private accumulator = 0;
  private rateAccumulator = 0;
  private _alpha = 1;
  private bursts: BurstState[] = [];
  private readonly random: () => number;

  constructor(
    public readonly capacity: number,
    public readonly dimensions: 2 | 3,
    public readonly options: ParticleSimulationOptions<D, T> = {},
  ) {
    if (!(capacity > 0) || !Number.isInteger(capacity)) {
      throw new Error(`Particle system capacity must be a positive integer, got ${capacity}`);
    }
    this.buffers = createParticleRenderBuffers(capacity, dimensions);
    for (let i = 0; i < capacity; i++) {
      this.pool.push(new Particle<D, T>(i, dimensions));
    }
    this.free = [...this.pool].reverse();
    this.emitting = options.emitting ?? true;
    this.random = options.random ?? Math.random;
    this.transform = {
      pointToSim: local => this.copyOf(local),
      directionToSim: local => this.copyOf(local),
    };
    this.resetBursts();
  }

  /** How many particles are alive. */
  public get count(): number {
    let n = 0;
    for (const p of this.live) {
      if (p.alive) {
        n++;
      }
    }
    return n;
  }

  /** Calls `callback` for every live particle, oldest first. */
  public forEachParticle(callback: (particle: Particle<D, T>) => void): void {
    for (const p of [...this.live]) {
      if (p.alive) {
        callback(p);
      }
    }
  }

  /**
   * Spawns up to `count` particles now. Each gets the defaults from the options, then the options'
   * `init`, then `init` given here.
   * @returns How many were spawned: fewer than `count` only with a full pool, with `overflow: 'drop'`
   * (or when the only live particle is the one whose `update` callback is emitting)
   */
  public emit(count: number, init?: ParticleInit<D, T>): number {
    if (!(count >= 1)) {
      return 0;
    }
    count = Math.floor(count);
    const zero = zeroParticleVector<D>(this.dimensions) as unknown as D;
    const origin = this.transform.pointToSim(zero) as unknown as D;
    const ctx = {
      index: 0,
      count,
      origin,
      time: this.time,
      pointToSim: (local: D) => this.transform.pointToSim(local),
      directionToSim: (local: D) => this.transform.directionToSim(local),
      random: this.random,
      range: (min: number, max: number) => min + (max - min) * this.random(),
    };
    let spawned = 0;
    for (let i = 0; i < count; i++) {
      const particle = this.acquire();
      if (!particle) {
        break;
      }
      ctx.index = i;
      this.spawn(particle, origin);
      this.options.init?.(particle, ctx);
      init?.(particle, ctx);
      if (particle.frameSequence) {
        particle.frame = this.sequenceFrame(particle);
      }
      particle.savePrevious();
      spawned++;
    }
    return spawned;
  }

  /**
   * Advances the simulation by `delta` seconds of world time (scaled by `timeScale`): one step of
   * that length, or as many `fixedTimeStep` steps as fit, carrying the rest over.
   * @returns How many steps ran
   */
  public advance(delta: number): number {
    const dt = delta * this.timeScale;
    if (!(dt > 0)) {
      return 0;
    }
    const fixed = this.options.fixedTimeStep;
    if (!(fixed && fixed > 0)) {
      this.step(dt);
      this._alpha = 1;
      return 1;
    }
    this.accumulator += dt;
    const maxSteps = this.options.maxStepsPerTick ?? 8;
    let steps = 0;
    while (this.accumulator >= fixed - TIME_EPSILON) {
      if (steps >= maxSteps) {
        this.accumulator = 0;
        break;
      }
      this.step(fixed);
      this.accumulator -= fixed;
      steps++;
    }
    if (this.accumulator < 0) {
      this.accumulator = 0;
    }
    this._alpha = this.options.interpolate === false ? 1 : Math.min(1, this.accumulator / fixed);
    return steps;
  }

  /** Runs exactly one simulation step of `dt` seconds (see the class doc for what happens in it). */
  public step(dt: number): void {
    this.time += dt;
    const gravity = this.options.gravity as Point3 | undefined;
    const gx = gravity?.x ?? 0;
    const gy = gravity?.y ?? 0;
    const gz = gravity?.z ?? 0;
    const is3d = this.dimensions === 3;
    const update = this.options.update;
    // iterate a snapshot: an update callback may emit, which changes the live list; a particle
    // spawned during this loop (a reused slot further down the snapshot) first moves next step
    const firstNewSerial = this.serialCounter;
    const snapshot = this.scratch;
    snapshot.length = 0;
    for (const p of this.live) {
      snapshot.push(p);
    }
    for (const p of snapshot) {
      if (!p.alive || p.serial >= firstNewSerial) {
        continue;
      }
      p.savePrevious();
      p.age += dt;
      p.steps++;
      if (p.age >= p.lifetime - TIME_EPSILON) {
        p.alive = false;
        continue;
      }
      const v = p.velocity as Point3 & { z: number; x: number; y: number };
      const a = p.acceleration as Point3;
      const pos = p.position as Point3 & { z: number; x: number; y: number };
      v.x += (gx + a.x) * dt;
      v.y += (gy + a.y) * dt;
      if (is3d) {
        v.z += (gz + a.z) * dt;
      }
      if (p.drag > 0) {
        const k = Math.exp(-p.drag * dt);
        v.x *= k;
        v.y *= k;
        if (is3d) {
          v.z *= k;
        }
      }
      pos.x += v.x * dt;
      pos.y += v.y * dt;
      if (is3d) {
        pos.z += v.z * dt;
      }
      p.rotation += p.angularVelocity * dt;
      if (p.frameSequence) {
        p.frame = this.sequenceFrame(p);
      }
      if (update) {
        this.updating = p;
        update(p, dt, this);
        this.updating = null;
      }
    }
    snapshot.length = 0;
    this.compact();
    this.options.onStep?.(dt, this);
    if (this.emitting) {
      const rate = this.options.rate ?? 0;
      if (rate > 0) {
        this.rateAccumulator += rate * dt;
        const n = Math.floor(this.rateAccumulator + TIME_EPSILON);
        if (n > 0) {
          this.rateAccumulator -= n;
          this.emit(n);
        }
      }
      const defs = this.options.bursts ?? [];
      for (let i = 0; i < defs.length; i++) {
        const state = this.bursts[i];
        const interval = defs[i].interval ?? 0;
        while (state && state.remaining > 0 && state.next <= this.time + TIME_EPSILON) {
          this.emit(defs[i].count);
          state.remaining--;
          if (interval > 0) {
            state.next += interval;
          } else if (!isFinite(state.remaining)) {
            // every cycle at once, forever: nothing sensible to loop over, so fire once
            state.remaining = 0;
          }
        }
      }
    }
  }

  /**
   * Writes the live particles, interpolated per `interpolationAlpha`, into {@link buffers} in spawn
   * order and returns them.
   */
  public writeRenderBuffers(): ParticleRenderBuffers {
    const b = this.buffers;
    const dims = this.dimensions;
    const alpha = this._alpha;
    const frames = this.options.frames && this.options.frames.length > 0 ? this.options.frames : [FULL_PARTICLE_FRAME];
    const sizeCurve = this.options.sizeOverLife;
    const sizeCurveIsPerAxis =
      sizeCurve !== undefined &&
      sizeCurve !== null &&
      typeof sizeCurve === 'object' &&
      !Array.isArray(sizeCurve) &&
      'x' in sizeCurve;
    const opacityCurve = this.options.opacityOverLife;
    let n = 0;
    for (const p of this.live) {
      if (!p.alive) {
        continue;
      }
      const lerp = (from: number, to: number) => (alpha >= 1 ? to : from + (to - from) * alpha);
      const pos = p.position as Point3;
      const prev = p.prevPosition as Point3;
      const o = n * dims;
      b.position[o] = lerp(prev.x, pos.x);
      b.position[o + 1] = lerp(prev.y, pos.y);
      if (dims === 3) {
        b.position[o + 2] = lerp(prev.z, pos.z);
      }
      const t = normalizedAge(lerp(p.prevAge, p.age), p.lifetime);
      let sx: number;
      let sy: number;
      if (sizeCurveIsPerAxis) {
        const perAxis = sizeCurve as { x: ParticleCurve; y: ParticleCurve };
        sx = evaluateParticleCurve(perAxis.x, t, p);
        sy = evaluateParticleCurve(perAxis.y, t, p);
      } else {
        sx = sy = evaluateParticleCurve(sizeCurve as ParticleCurve | undefined, t, p);
      }
      b.size[n * 2] = lerp(p.prevSize.x, p.size.x) * sx;
      b.size[n * 2 + 1] = lerp(p.prevSize.y, p.size.y) * sy;
      b.rotation[n] = lerp(p.prevRotation, p.rotation);
      const opacity = lerp(p.prevOpacity, p.opacity) * evaluateParticleCurve(opacityCurve, t, p);
      const c = n * 4;
      b.color[c] = ((p.tint >> 16) & 0xff) / 255;
      b.color[c + 1] = ((p.tint >> 8) & 0xff) / 255;
      b.color[c + 2] = (p.tint & 0xff) / 255;
      b.color[c + 3] = Math.min(1, Math.max(0, opacity));
      const frameIndex = Math.min(frames.length - 1, Math.max(0, Math.round(p.frame) || 0));
      const frame = frames[frameIndex];
      b.uv[c] = frame.x;
      b.uv[c + 1] = frame.y;
      b.uv[c + 2] = frame.width;
      b.uv[c + 3] = frame.height;
      b.extra[c] = p.shaderData[0];
      b.extra[c + 1] = p.shaderData[1];
      b.extra[c + 2] = p.shaderData[2];
      b.extra[c + 3] = p.shaderData[3];
      n++;
    }
    b.count = n;
    return b;
  }

  /** Kills every particle. */
  public clear(): void {
    for (const p of this.live) {
      p.alive = false;
    }
    this.compact();
    this.buffers.count = 0;
  }

  /** Resets the simulation time to `0` and re-arms the bursts. With `clear`, kills every particle as well. */
  public restart(clear: boolean = false): void {
    this.time = 0;
    this.accumulator = 0;
    this.rateAccumulator = 0;
    this.resetBursts();
    if (clear) {
      this.clear();
    }
  }

  private resetBursts(): void {
    this.bursts = (this.options.bursts ?? []).map(b => ({ next: b.time, remaining: b.cycles ?? 1 }));
  }

  private copyOf(v: D): MutableParticleVector<D> {
    const out = zeroParticleVector<D>(this.dimensions);
    copyParticleVector(out, v);
    return out;
  }

  private acquire(): Particle<D, T> | null {
    let particle = this.free.pop();
    if (!particle) {
      this.compact();
      particle = this.free.pop();
    }
    if (particle) {
      this.live.push(particle);
      return particle;
    }
    if (this.options.overflow === 'drop') {
      return null;
    }
    // pool full and compacted: every live entry is alive, the first one is the oldest - unless it is
    // the particle whose update callback is emitting right now, which must survive its own callback
    let oldest = 0;
    if (this.live[0] === this.updating) {
      if (this.live.length < 2) {
        return null;
      }
      oldest = 1;
    }
    particle = this.live.splice(oldest, 1)[0];
    this.live.push(particle);
    return particle;
  }

  private spawn(p: Particle<D, T>, origin: D): void {
    const o = this.options;
    p.alive = true;
    p.serial = this.serialCounter++;
    p.position = origin;
    const zero = zeroParticleVector<D>(this.dimensions) as unknown as D;
    p.velocity = zero;
    p.acceleration = zero;
    p.drag = o.drag ?? 0;
    p.age = 0;
    p.steps = 0;
    const lifetime = o.lifetime ?? 1;
    p.lifetime = typeof lifetime === 'number' ? lifetime : lifetime[0] + (lifetime[1] - lifetime[0]) * this.random();
    const size = o.size ?? 1;
    if (typeof size === 'number') {
      p.size.x = p.size.y = size;
    } else {
      p.size = size;
    }
    p.opacity = o.opacity ?? 1;
    p.rotation = 0;
    p.angularVelocity = 0;
    p.tint = o.tint ?? 0xffffff;
    p.frame = 0;
    p.frameSequence = o.frameSequence ?? null;
    p.frameDuration = o.frameDuration ?? 0;
    p.frameLoop = o.frameLoop ?? false;
    p.shaderData[0] = p.shaderData[1] = p.shaderData[2] = p.shaderData[3] = 0;
    p.data = undefined;
  }

  private sequenceFrame(p: Particle<D, T>): number {
    const sequence = p.frameSequence!;
    const n = sequence.length;
    if (n === 0) {
      return p.frame;
    }
    let i: number;
    if (p.frameDuration > 0) {
      i = Math.floor(p.age / p.frameDuration + TIME_EPSILON);
    } else {
      i = Math.floor(normalizedAge(p.age, p.lifetime) * n);
    }
    i = p.frameLoop ? i % n : Math.min(i, n - 1);
    return sequence[i];
  }

  /** drops dead particles from the live list, keeping spawn order, and returns them to the pool */
  private compact(): void {
    let write = 0;
    const live = this.live;
    for (let read = 0; read < live.length; read++) {
      const p = live[read];
      if (p.alive) {
        live[write++] = p;
      } else {
        this.free.push(p);
      }
    }
    live.length = write;
  }
}
