import { AudioSourceDescriptor, IEntity, Pnt3, Point3, Point4, Qtrn, TickOrder } from '../../base';
import { IPositionable3d } from '../interfaces/i-positionable-3d';
import { Gg3dWorld, Gg3dWorldTypeDocRepo } from '../gg-3d-world';

/**
 * Wraps one `IAudioSource3dComponent` as a world entity - the audio analogue of `Entity3d`. Three
 * placement modes, all built from the same class (see the audio RFC's "Placing a sound" section):
 *
 * - **Static**: construct with no `attachTo`. Position/rotation are whatever `source` already has
 *   (or whatever's set on the returned entity afterwards) - never touched again.
 * - **Attached**: construct with `attachTo` (any `IPositionable3d` - typically another entity).
 *   Position/rotation are copied from it every tick, so the sound rides that target around (a car
 *   engine, machinery hum).
 * - **Transient**: {@link playOneShot} - plays once and removes+disposes itself from the world the
 *   moment playback ends. The app never has to hold a reference past the call.
 */
export class AudioSource3dEntity<TypeDoc extends Gg3dWorldTypeDocRepo = Gg3dWorldTypeDocRepo>
  extends IEntity<Point3, Point4, TypeDoc>
  implements IPositionable3d
{
  // A touch above OBJECTS_BINDING (400), not equal to it: an attached source must read its
  // target's transform *after* that target has been synced from physics this same frame, and
  // same-tickOrder ties resolve by addEntity() insertion order, not declaration order (see
  // gg-engine-core-development's tickOrder note) - a strictly higher value sidesteps the
  // ambiguity entirely instead of depending on spawn order happening to be correct.
  public readonly tickOrder = TickOrder.OBJECTS_BINDING + 10;

  private _position: Point3 = Pnt3.O;
  public get position(): Point3 {
    return this._position;
  }

  set position(value: Point3) {
    this.source.position = value;
    this._position = value;
  }

  private _rotation: Point4 = Qtrn.O;
  public get rotation(): Point4 {
    return this._rotation;
  }

  set rotation(value: Point4) {
    this.source.rotation = value;
    this._rotation = value;
  }

  constructor(
    public readonly source: TypeDoc['aTypeDoc']['source'],
    private readonly attachTo?: IPositionable3d | null,
  ) {
    super();
    this.addComponents(this.source);
    if (this.attachTo) {
      this.position = this.attachTo.position;
      this.rotation = this.attachTo.rotation;
      this.tick$.subscribe(() => {
        this.position = this.attachTo!.position;
        this.rotation = this.attachTo!.rotation;
      });
    } else {
      this._position = this.source.position;
      this._rotation = this.source.rotation;
    }
  }

  public play(): void {
    this.source.play();
  }

  public pause(): void {
    this.source.pause();
  }

  public stop(): void {
    this.source.stop();
  }

  /**
   * Spawn a transient, self-disposing one-shot sound at a fixed position: creates the source,
   * adds a new `AudioSource3dEntity` to `world`, plays it, and removes+disposes it the moment
   * playback ends. The returned entity is only useful for advanced cases (e.g. stopping it early)
   * - normally nothing needs to hold onto it.
   * @throws if `world` has no `audioScene`
   */
  public static playOneShot<TypeDoc extends Gg3dWorldTypeDocRepo = Gg3dWorldTypeDocRepo>(
    world: Gg3dWorld<TypeDoc>,
    descriptor: AudioSourceDescriptor<TypeDoc['aTypeDoc']['clip']>,
    position: Point3,
    rotation: Point4 = Qtrn.O,
  ): AudioSource3dEntity<TypeDoc> {
    if (!world.audioScene) {
      throw new Error('Cannot play a one-shot sound in a world without an audioScene');
    }
    const source = world.audioScene.factory.createSource({ ...descriptor, loop: false, autoplay: false });
    const entity = new AudioSource3dEntity<TypeDoc>(source);
    entity.position = position;
    entity.rotation = rotation;
    world.addEntity(entity);
    const subscription = source.ended$.subscribe(() => {
      subscription.unsubscribe();
      world.removeEntity(entity, true);
    });
    source.play();
    return entity;
  }
}
