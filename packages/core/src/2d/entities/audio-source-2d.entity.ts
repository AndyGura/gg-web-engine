import { AudioSourceDescriptor, IEntity, Pnt2, Point2, TickOrder } from '../../base';
import { IPositionable2d } from '../interfaces/i-positionable-2d';
import { Gg2dWorld, Gg2dWorldTypeDocRepo } from '../gg-2d-world';

/**
 * 2D counterpart of `AudioSource3dEntity` - see that class's doc for the three placement modes
 * (static/attached/transient). `rotation` is a plain angle (radians), same convention as
 * `Entity2d`.
 */
export class AudioSource2dEntity<TypeDoc extends Gg2dWorldTypeDocRepo = Gg2dWorldTypeDocRepo>
  extends IEntity<Point2, number, TypeDoc>
  implements IPositionable2d
{
  // See AudioSource3dEntity's doc for why this sits just above OBJECTS_BINDING rather than at it.
  public readonly tickOrder = TickOrder.OBJECTS_BINDING + 10;

  private _position: Point2 = Pnt2.O;
  public get position(): Point2 {
    return this._position;
  }

  set position(value: Point2) {
    this.source.position = value;
    this._position = value;
  }

  private _rotation = 0;
  public get rotation(): number {
    return this._rotation;
  }

  set rotation(value: number) {
    this.source.rotation = value;
    this._rotation = value;
  }

  constructor(
    public readonly source: TypeDoc['aTypeDoc']['source'],
    private readonly attachTo?: IPositionable2d | null,
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
   * Spawn a transient, self-disposing one-shot sound at a fixed position - see
   * `AudioSource3dEntity.playOneShot`'s doc for the full contract.
   * @throws if `world` has no `audioScene`
   */
  public static playOneShot<TypeDoc extends Gg2dWorldTypeDocRepo = Gg2dWorldTypeDocRepo>(
    world: Gg2dWorld<TypeDoc>,
    descriptor: AudioSourceDescriptor<TypeDoc['aTypeDoc']['clip']>,
    position: Point2,
    rotation: number = 0,
  ): AudioSource2dEntity<TypeDoc> {
    if (!world.audioScene) {
      throw new Error('Cannot play a one-shot sound in a world without an audioScene');
    }
    const source = world.audioScene.factory.createSource({ ...descriptor, loop: false, autoplay: false });
    const entity = new AudioSource2dEntity<TypeDoc>(source);
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
