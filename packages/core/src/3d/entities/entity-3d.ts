import { Pnt3, Point3, Point4, Qtrn, TickOrder } from '../../base';
import { IRigidBody3dComponent } from '../components/physics/i-rigid-body-3d.component';
import { IDisplayObject3dComponent } from '../components/rendering/i-display-object-3d.component';
import { IPositionable3d } from '../interfaces/i-positionable-3d';
import { IRenderable3dEntity } from './i-renderable-3d.entity';
import { PhysicsTypeDocRepo3D, VisualTypeDocRepo3D } from '../gg-3d-world';

export class Entity3d<
    VTypeDoc extends VisualTypeDocRepo3D = VisualTypeDocRepo3D,
    PTypeDoc extends PhysicsTypeDocRepo3D = PhysicsTypeDocRepo3D,
  >
  extends IRenderable3dEntity<VTypeDoc, PTypeDoc>
  implements IPositionable3d
{
  public readonly tickOrder = TickOrder.OBJECTS_BINDING;

  private _position = Pnt3.O;
  public get position(): Point3 {
    return this._position;
  }

  set position(value: Point3) {
    if (this.object3D) {
      this.object3D.position = value;
    }
    if (this.objectBody) {
      this.objectBody.position = value;
    }
    this._position = value;
  }

  private _rotation = Qtrn.O;
  public get rotation(): Point4 {
    return this._rotation;
  }

  set rotation(value: Point4) {
    if (this.object3D) {
      this.object3D.rotation = value;
    }
    if (this.objectBody) {
      this.objectBody.rotation = value;
    }
    this._rotation = value;
  }

  public readonly object3D: VTypeDoc['displayObject'] | null = null;
  public readonly objectBody: PTypeDoc['rigidBody'] | null = null;

  public updateVisibility(): void {
    if (this.object3D) {
      this.object3D.visible = this.worldVisible;
    }
    super.updateVisibility();
  }

  /**
   * Synchronize physics body transform with entity (and mesh if defined)
   * */
  protected runTransformBinding(objectBody: IRigidBody3dComponent, object3D: IDisplayObject3dComponent | null): void {
    const pos = objectBody.position;
    const quat = objectBody.rotation;
    if (object3D) {
      object3D.position = pos;
      object3D.rotation = quat;
    }
    this._position = pos;
    this._rotation = quat;
  }

  constructor(options: { object3D?: VTypeDoc['displayObject'] | null; objectBody?: PTypeDoc['rigidBody'] | null }) {
    super();
    if (options.objectBody) {
      this.objectBody = options.objectBody;
      this.name = this.objectBody.name;
      this.addComponents(this.objectBody);
    }
    if (options.object3D) {
      this.object3D = options.object3D;
      if (!options.objectBody) {
        this._position = this.object3D.position;
        this._rotation = this.object3D.rotation;
        this.name = this.object3D.name;
      }
      this.addComponents(this.object3D);
    }
    if (this.objectBody) {
      this.tick$.subscribe(() => {
        this.runTransformBinding(this.objectBody!, this.object3D);
      });
      this.runTransformBinding(this.objectBody, this.object3D);
    }
  }
}
