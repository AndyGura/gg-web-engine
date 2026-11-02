import { IPositionable2d } from '../interfaces/i-positionable-2d';
import { IEntity, Pnt2, Point2, TickOrder } from '../../base';
import { Gg2dWorldTypeDocVPatch, VisualTypeDocRepo2D } from '../gg-2d-world';

/**
 * A positioned entity wrapping a camera component (`VTypeDoc['camera']`, e.g. the adapter-specific
 * camera type an app's `TypedGg2dWorld` uses) - not attached to any renderer/canvas itself (pass
 * `.camera` to `Gg2dWorld.addRenderer` for that), but addressable in the world/entity trees like
 * any other entity: `world.addEntity`/`getEntityByName`, `IEntity.getChildEntityByName`,
 * `removeEntity`. The 2D counterpart of `Camera3dEntity`; the level loader's `"Camera"` class
 * builds one.
 * @template VTypeDoc - The visual type document repository (parametrize this the same way an
 * app's world type is, e.g. `Camera2dEntity<PixiVisualTypeDocRepo2D>`, so `.camera` comes back as
 * the adapter-specific camera type rather than the unbound base `ICamera2dComponent`)
 */
export class Camera2dEntity<VTypeDoc extends VisualTypeDocRepo2D = VisualTypeDocRepo2D>
  extends IEntity<Point2, number, Gg2dWorldTypeDocVPatch<VTypeDoc>>
  implements IPositionable2d
{
  static readonly entityTypeName: string = 'Camera2dEntity';
  public readonly tickOrder = TickOrder.OBJECTS_BINDING;

  private _position = Pnt2.O;
  public get position(): Point2 {
    return this._position;
  }

  set position(value: Point2) {
    this.camera.position = value;
    this._position = value;
  }

  private _rotation = 0;
  public get rotation(): number {
    return this._rotation;
  }

  set rotation(value: number) {
    this.camera.rotation = value;
    this._rotation = value;
  }

  constructor(public readonly camera: VTypeDoc['camera']) {
    super();
    this.addComponents(this.camera);
  }
}
