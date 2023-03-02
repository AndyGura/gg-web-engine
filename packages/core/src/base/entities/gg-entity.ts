import { GgWorld } from '../gg-world';

export abstract class GgEntity {

  get world(): GgWorld<any, any> | null {
    return this._world;
  }

  protected _world: GgWorld<any, any> | null = null;

  protected _children: GgEntity[] = [];

  public addChildren(...entities: GgEntity[]) {
    this._children.push(...entities);
    if (this._world) {
      for (const item of entities) {
        this._world.addEntity(item);
      }
    }
  }

  public removeChildren(entities: GgEntity[], dispose: boolean = false) {
    this._children = this._children.filter(c => !entities.includes(c));
    if (this._world) {
      for (const item of entities) {
        this._world.removeEntity(item, dispose);
      }
    }
  }

  public onSpawned(world: GgWorld<any, any>) {
    this._world = world;
    for (const c of this._children) {
      world.addEntity(c);
    }
  }

  public onRemoved() {
    const world = this._world!;
    this._world = null;
    for (const c of this._children) {
      world.removeEntity(c);
    }
  }

  // TODO add some flag to entity that it is disposed, and throw a normal error when trying to add such entity to world again
  public dispose(): void {
    for (const c of this._children) {
      c.dispose();
    }
  }

}
