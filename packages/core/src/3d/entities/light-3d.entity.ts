import { IPositionable3d } from '../interfaces/i-positionable-3d';
import { IEntity, Pnt3, Point3, Point4, Qtrn, TickOrder } from '../../base';
import { Gg3dWorldTypeDocVPatch, VisualTypeDocRepo3D } from '../gg-3d-world';

/**
 * A positioned entity wrapping a light component (`VTypeDoc['light']`, see `ILight3dComponent`),
 * created by `Gg3dWorld.addLight` or the `"Light"` level-JSON class, or by hand from
 * `visualScene.factory.createLight(...)`. Addressable in the world/entity trees like any other
 * entity, and removing it removes the light from the scene.
 * @template VTypeDoc - The visual type document repository (parametrize it the same way the app's
 * world type is, so `.light` comes back as the adapter-specific light type)
 */
export class Light3dEntity<VTypeDoc extends VisualTypeDocRepo3D = VisualTypeDocRepo3D>
  extends IEntity<Point3, Point4, Gg3dWorldTypeDocVPatch<VTypeDoc>>
  implements IPositionable3d
{
  static readonly entityTypeName: string = 'Light3dEntity';
  public readonly tickOrder = TickOrder.OBJECTS_BINDING;

  private _position = Pnt3.O;
  public get position(): Point3 {
    return this._position;
  }

  set position(value: Point3) {
    this.light.position = value;
    this._position = value;
  }

  private _rotation = Qtrn.O;
  public get rotation(): Point4 {
    return this._rotation;
  }

  set rotation(value: Point4) {
    this.light.rotation = value;
    this._rotation = value;
  }

  constructor(public readonly light: VTypeDoc['light']) {
    super();
    this.addComponents(this.light);
  }

  /**
   * Rotates the light so it shines from its current position towards `target` - what `DIRECTIONAL`
   * and `SPOT` lights normally want. Call it again after moving the light to keep it aimed.
   */
  lookAt(target: Point3): void {
    this.rotation = Qtrn.lookAt(this._position, target);
  }
}
