import { Pnt3, Point3, Point4, Qtrn, TickOrder } from '../../base';
import { IRigidBody3dComponent } from '../components/physics/i-rigid-body-3d.component';
import { IDisplayObject3dComponent } from '../components/rendering/i-display-object-3d.component';
import { IPositionable3d } from '../interfaces/i-positionable-3d';
import { IRenderable3dEntity } from './i-renderable-3d.entity';
import { IVisualScene3dComponent } from '../components/rendering/i-visual-scene-3d.component';
import { IPhysicsWorld3dComponent } from '../components/physics/i-physics-world-3d';

export class Entity3d<
    VS extends IVisualScene3dComponent = IVisualScene3dComponent,
    PW extends IPhysicsWorld3dComponent = IPhysicsWorld3dComponent,
  >
  extends IRenderable3dEntity<VS, PW>
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

  constructor(
    public readonly object3D: IDisplayObject3dComponent | null,
    public readonly objectBody: IRigidBody3dComponent | null = null,
  ) {
    super();
    if (objectBody) {
      this.tick$.subscribe(() => {
        this.runTransformBinding(objectBody, object3D);
      });
      this.runTransformBinding(objectBody, object3D);
      this.name = objectBody.name;
    } else if (object3D) {
      this._position = object3D.position;
      this._rotation = object3D.rotation;
      this.name = object3D.name;
    } else {
      throw new Error('Cannot create entity without a mesh and a body');
    }
    objectBody && this.addComponents(objectBody);
    object3D && this.addComponents(object3D);
  }
}
