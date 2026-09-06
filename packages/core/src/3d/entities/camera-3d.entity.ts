import { IPositionable3d } from '../interfaces/i-positionable-3d';
import { IEntity, Pnt3, Point3, Point4, Qtrn, TickOrder } from '../../base';
import { Gg3dWorldTypeDocVPatch, VisualTypeDocRepo3D } from '../gg-3d-world';

/**
 * A positioned entity wrapping a camera component (`VTypeDoc['camera']`, e.g. the adapter-specific
 * camera type an app's `TypedGg3dWorld` uses) - not attached to any renderer/canvas itself (pass
 * `.camera` to `Gg3dWorld.addRenderer` for that), but addressable in the world/entity trees like
 * any other entity: `world.addEntity`/`getEntityByName`, `IEntity.getChildEntityByName`,
 * `removeEntity`.
 * @template VTypeDoc - The visual type document repository (parametrize this the same way an
 * app's world type is, e.g. `Camera3dEntity<ThreeVisualTypeDocRepo>`, so `.camera` comes back as
 * the adapter-specific camera type rather than the unbound base `ICamera3dComponent`)
 */
export class Camera3dEntity<VTypeDoc extends VisualTypeDocRepo3D = VisualTypeDocRepo3D>
  extends IEntity<Point3, Point4, Gg3dWorldTypeDocVPatch<VTypeDoc>>
  implements IPositionable3d
{
  public readonly tickOrder = TickOrder.OBJECTS_BINDING;

  private _position = Pnt3.O;
  public get position(): Point3 {
    return this._position;
  }

  set position(value: Point3) {
    this.camera.position = value;
    this._position = value;
  }

  private _rotation = Qtrn.O;
  public get rotation(): Point4 {
    return this._rotation;
  }

  set rotation(value: Point4) {
    this.camera.rotation = value;
    this._rotation = value;
  }

  constructor(public readonly camera: VTypeDoc['camera']) {
    super();
    this.addComponents(this.camera);
  }
}
