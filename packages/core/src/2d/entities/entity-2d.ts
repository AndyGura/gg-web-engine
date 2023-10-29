import { Pnt2, Point2, TickOrder } from '../../base';
import { IRigidBody2dComponent } from '../components/physics/i-rigid-body-2d.component';
import { IDisplayObject2dComponent } from '../components/rendering/i-display-object-2d.component';
import { IPositionable2d } from '../interfaces/i-positionable-2d';
import { IRenderable2dEntity } from './i-renderable-2d.entity';
import { IVisualScene2dComponent } from '../components/rendering/i-visual-scene-2d.component';
import { IPhysicsWorld2dComponent } from '../components/physics/i-physics-world-2d.component';

export class Entity2d<
    VS extends IVisualScene2dComponent = IVisualScene2dComponent,
    PW extends IPhysicsWorld2dComponent = IPhysicsWorld2dComponent,
  >
  extends IRenderable2dEntity<VS, PW>
  implements IPositionable2d
{
  public readonly tickOrder = TickOrder.OBJECTS_BINDING;

  private _position = Pnt2.O;
  public get position(): Point2 {
    return this._position;
  }

  set position(value: Point2) {
    if (this.object2D) {
      this.object2D.position = value;
    }
    if (this.objectBody) {
      this.objectBody.position = value;
    }
    this._position = value;
  }

  private _rotation = 0;
  public get rotation(): number {
    return this._rotation;
  }

  set rotation(value: number) {
    if (this.object2D) {
      this.object2D.rotation = value;
    }
    if (this.objectBody) {
      this.objectBody.rotation = value;
    }
    this._rotation = value;
  }

  public updateVisibility(): void {
    if (this.object2D) {
      this.object2D.visible = this.worldVisible;
    }
    super.updateVisibility();
  }

  /**
   * Synchronize physics body transform with entity (and object2d if defined)
   * */
  protected runTransformBinding(objectBody: IRigidBody2dComponent, object2D: IDisplayObject2dComponent | null): void {
    const pos = objectBody.position;
    const quat = objectBody.rotation;
    if (object2D) {
      object2D.position = pos;
      object2D.rotation = quat;
    }
    this._position = pos;
    this._rotation = quat;
  }

  constructor(
    public readonly object2D: IDisplayObject2dComponent | null,
    public readonly objectBody: IRigidBody2dComponent | null,
  ) {
    super();
    if (objectBody) {
      this.tick$.subscribe(() => {
        this.runTransformBinding(objectBody, object2D);
      });
      this.runTransformBinding(objectBody, object2D);
      this.name = objectBody.name;
    } else if (object2D) {
      this._position = object2D.position;
      this._rotation = object2D.rotation;
      this.name = object2D.name;
    } else {
      throw new Error('Cannot create entity without an object2D and a body');
    }
    objectBody && this.addComponents(objectBody);
    object2D && this.addComponents(object2D);
  }
}
