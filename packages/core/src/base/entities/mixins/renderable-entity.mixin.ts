import { GgEntity } from '../gg-entity';

const updateRecv = (item: GgEntity) => {
  if (!!(item as any).updateVisibility) {
    (item as any).updateVisibility();
  } else {
    updateChildrenRecv(item);
  }
};

const updateChildrenRecv = (item: GgEntity) => {
  for (const child of item.children) {
    updateRecv(child);
  }
};

export abstract class RenderableEntityMixin extends GgEntity {
  private _visible: boolean = true;

  public get visible(): boolean {
    return this._visible;
  }

  public get worldVisible(): boolean {
    let item: GgEntity = this;
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

  addChildren(...entities: GgEntity[]) {
    super.addChildren(...entities);
    for (const entity of entities) {
      updateRecv(entity);
    }
  }

  removeChildren(entities: GgEntity[], dispose: boolean = false) {
    super.removeChildren(entities, dispose);
    if (!dispose) {
      for (const entity of entities) {
        updateRecv(entity);
      }
    }
  }
}
