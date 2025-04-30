import { IEntity } from './i-entity';
import { GgWorldTypeDocRepo } from '../gg-world';

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

export abstract class IRenderableEntity<
  D = any,
  R = any,
  TypeDoc extends GgWorldTypeDocRepo<D, R> = GgWorldTypeDocRepo<D, R>,
> extends IEntity<D, R, TypeDoc> {
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
