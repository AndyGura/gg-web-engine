import {
  MutablePoint2,
  Particle,
  ParticleInit,
  ParticleSimulation,
  ParticleSimulationOptions,
  Pnt2,
  Point2,
  TickOrder,
} from '../../base';
import { IPositionable2d } from '../interfaces/i-positionable-2d';
import { Gg2dWorldTypeDocVPatch, VisualTypeDocRepo2D } from '../gg-2d-world';
import { IRenderable2dEntity } from './i-renderable-2d.entity';

/**
 * Settings of a `ParticleSystem2dEntity`: the simulation (see `ParticleSimulationOptions` - every
 * duration in seconds) plus where the emitter is.
 * @template T - The type of `Particle.data`
 */
export type ParticleSystem2dOptions<T = any> = ParticleSimulationOptions<Point2, T> & {
  /**
   * Something to follow (any entity, or anything with a `position` and `rotation`): the emitter sits
   * at `offset` in its frame, re-read on every tick and on every `emit()` call. Can be changed later
   * with `attachTo()`/`detach()`.
   */
  attachTo?: IPositionable2d | null;
  /** The emitter's position in the frame of `attachTo`. Default: its origin. */
  offset?: Point2;
};

/**
 * A 2D particle system: sprites spawned by the app or by a rate/bursts, simulated in core
 * (`ParticleSimulation`, available as {@link simulation}) and drawn by the visual adapter's
 * `IParticleSystem2dComponent`. Create one with `Gg2dWorld.addParticleSystem`, or construct it
 * around `visualScene.factory.createParticleSystem(...)` and add it to a world.
 *
 * Runs on the world clock (it pauses with the world), once per world tick right before rendering,
 * or in fixed steps with `fixedTimeStep`. The emitter is this entity's `position`/`rotation`, or
 * follows another entity (`attachTo`) with a local `offset`; particles are spawned in world space
 * and stay there (or move with the emitter, with `space: 'local'`). Sizes and speeds are in world
 * units, and a particle's `rotation` uses the 2D world's own rotation sign.
 *
 * ```ts
 * const sparks = world.addParticleSystem(
 *   { capacity: 100, texture, blending: 'additive', zIndex: 5 },
 *   { lifetime: [0.3, 0.6], size: 6, gravity: { x: 0, y: 600 }, opacityOverLife: [1, 0] },
 * );
 * sparks.emit(12, (p, ctx) => {
 *   p.position = coin.position;
 *   p.velocity = Pnt2.rot({ x: ctx.range(100, 200), y: 0 }, ctx.random() * Math.PI * 2);
 * });
 * ```
 * @template VTypeDoc - The visual type document repository (as the app's world is parametrized)
 * @template T - The type of `Particle.data`
 */
export class ParticleSystem2dEntity<VTypeDoc extends VisualTypeDocRepo2D = VisualTypeDocRepo2D, T = any>
  extends IRenderable2dEntity<Gg2dWorldTypeDocVPatch<VTypeDoc>>
  implements IPositionable2d
{
  static readonly entityTypeName: string = 'ParticleSystem2dEntity';
  // after every controller, animator and physics sync of the frame, so an attached emitter reads its
  // target's final transform, and right before the renderers draw what was simulated
  public readonly tickOrder = TickOrder.RENDERING - 10;

  public readonly simulation: ParticleSimulation<Point2, T>;

  private _attachTo: IPositionable2d | null = null;
  private _offset: Point2 = Pnt2.O;

  private _position: Point2 = Pnt2.O;
  /** The emitter's position (with `attachTo`, where the target and offset put it at the last update). */
  public get position(): Point2 {
    return this._position;
  }

  /** Moves the emitter. Ignored while attached (it follows the target then). */
  set position(value: Point2) {
    if (this._attachTo) {
      return;
    }
    this._position = value;
    this.applyLocalSpaceTransform();
  }

  private _rotation: number = 0;
  /** The emitter's rotation (with `attachTo`, the target's). */
  public get rotation(): number {
    return this._rotation;
  }

  /** Turns the emitter. Ignored while attached (it follows the target then). */
  set rotation(value: number) {
    if (this._attachTo) {
      return;
    }
    this._rotation = value;
    this.applyLocalSpaceTransform();
  }

  /** Whether particles live in the emitter's frame (`space: 'local'`) rather than in world space. */
  public get isLocalSpace(): boolean {
    return this.simulation.options.space === 'local';
  }

  constructor(
    public readonly particleSystem: VTypeDoc['particleSystem'],
    options: ParticleSystem2dOptions<T> = {},
  ) {
    super();
    this.simulation = new ParticleSimulation<Point2, T>(particleSystem.capacity, 2, options);
    this.simulation.transform = {
      pointToSim: local => this.pointToSim(local),
      directionToSim: local => this.directionToSim(local),
    };
    this.addComponents(this.particleSystem);
    if (options.attachTo) {
      this.attachTo(options.attachTo, options.offset);
    } else {
      this.applyLocalSpaceTransform();
    }
    this.tick$.subscribe(([, delta]) => this.update(delta / 1000));
  }

  /**
   * Makes the emitter follow `target` (an entity, or anything with a `position` and `rotation`), at
   * `offset` in the target's frame. Particles already spawned are not affected (in world space).
   */
  public attachTo(target: IPositionable2d, offset: Point2 = Pnt2.O): void {
    this._attachTo = target;
    this._offset = offset;
    this.syncAttachment();
  }

  /** Stops following the target; the emitter stays where it was. */
  public detach(): void {
    this.syncAttachment();
    this._attachTo = null;
  }

  /** What the emitter follows, if anything. */
  public get attachedTo(): IPositionable2d | null {
    return this._attachTo;
  }

  /** Whether `rate`/`bursts` spawn particles (`emit()` always works). */
  public get emitting(): boolean {
    return this.simulation.emitting;
  }

  public set emitting(value: boolean) {
    this.simulation.emitting = value;
  }

  /** Live particles. */
  public get count(): number {
    return this.simulation.count;
  }

  /**
   * Spawns up to `count` particles now (see `ParticleSimulation.emit`). Each starts at the emitter's
   * origin with the options' defaults; the options' `init`, then `init` given here, set it up. The
   * context's `pointToSim`/`directionToSim` map emitter-local points (relative to the attached
   * target, offset included) into the particles' space.
   * @returns How many were spawned
   */
  public emit(count: number, init?: ParticleInit<Point2, T>): number {
    this.syncAttachment();
    return this.simulation.emit(count, init);
  }

  /** Calls `callback` for every live particle, oldest first. */
  public forEachParticle(callback: (particle: Particle<Point2, T>) => void): void {
    this.simulation.forEachParticle(callback);
  }

  /** Kills every particle. */
  public clear(): void {
    this.simulation.clear();
    this.particleSystem.setParticles(this.simulation.buffers);
  }

  /**
   * Advances the simulation by `delta` seconds and hands the result to the visual component. The
   * world calls it every tick; call it yourself only to drive a system outside of a world.
   */
  public update(delta: number): void {
    this.syncAttachment();
    this.simulation.advance(delta);
    this.particleSystem.setParticles(this.simulation.writeRenderBuffers());
  }

  public updateVisibility(): void {
    this.particleSystem.visible = this.worldVisible;
    super.updateVisibility();
  }

  private syncAttachment(): void {
    const target = this._attachTo;
    if (!target) {
      return;
    }
    const rotation = target.rotation;
    this._rotation = rotation;
    this._position = Pnt2.add(target.position, Pnt2.rot(this._offset, rotation));
    this.applyLocalSpaceTransform();
  }

  private applyLocalSpaceTransform(): void {
    if (this.isLocalSpace) {
      this.particleSystem.position = this._position;
      this.particleSystem.rotation = this._rotation;
    }
  }

  private pointToSim(local: Point2): MutablePoint2 {
    if (this.isLocalSpace) {
      return { x: local.x, y: local.y };
    }
    const r = Pnt2.rot(local, this._rotation);
    return { x: this._position.x + r.x, y: this._position.y + r.y };
  }

  private directionToSim(local: Point2): MutablePoint2 {
    if (this.isLocalSpace) {
      return { x: local.x, y: local.y };
    }
    const r = Pnt2.rot(local, this._rotation);
    return { x: r.x, y: r.y };
  }
}
