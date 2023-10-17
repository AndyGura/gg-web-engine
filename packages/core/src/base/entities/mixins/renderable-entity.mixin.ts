import { IEntity } from '../i-entity';
import { IVisualSceneComponent } from '../../components/rendering/i-visual-scene.component';
import { IPhysicsWorldComponent } from '../../components/physics/i-physics-world.component';
import { Point2, Point3, Point4 } from '../../models/points';
import { IPhysicsWorld3dComponent, IVisualScene3dComponent } from '../../../3d';
import { IPhysicsWorld2dComponent, IVisualScene2dComponent } from '../../../2d';

const updateRecv = (item: IEntity) => {
  if (!!(item as any).updateVisibility) {
    (item as any).updateVisibility();
  } else {
    updateChildrenRecv(item);
  }
};

const updateChildrenRecv = (item: IEntity) => {
  for (const child of item.children) {
    updateRecv(child);
  }
};

export abstract class RenderableEntityMixin<
  D = any,
  R = any,
  V extends IVisualSceneComponent<D, R> = IVisualSceneComponent<D, R>,
  P extends IPhysicsWorldComponent<D, R> = IPhysicsWorldComponent<D, R>,
> extends IEntity<D, R, V, P> {
  private _visible: boolean = true;

  public get visible(): boolean {
    return this._visible;
  }

  public get worldVisible(): boolean {
    let item: IEntity = this;
    while (true) {
      if ((item as any).visible === false) {
        return false;
      }
      if (!item.parent) {
        break;
      }
      item = item.parent;
    }
    return true;
  }

  set visible(value: boolean) {
    this._visible = value;
    this.updateVisibility();
  }

  public updateVisibility(): void {
    updateChildrenRecv(this);
  }

  addChildren(...entities: IEntity[]) {
    super.addChildren(...entities);
    for (const entity of entities) {
      updateRecv(entity);
    }
  }

  removeChildren(entities: IEntity[], dispose: boolean = false) {
    super.removeChildren(entities, dispose);
    if (!dispose) {
      for (const entity of entities) {
        updateRecv(entity);
      }
    }
  }
}

export abstract class RenderableEntityMixin3d extends RenderableEntityMixin<
  Point3,
  Point4,
  IVisualScene3dComponent,
  IPhysicsWorld3dComponent
> {}

export abstract class RenderableEntityMixin2d extends RenderableEntityMixin<
  Point2,
  number,
  IVisualScene2dComponent,
  IPhysicsWorld2dComponent
> {}
