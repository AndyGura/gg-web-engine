import { GgWorld } from '../gg-world';
import { Subject } from 'rxjs';

export abstract class GgEntity {
  protected _world: GgWorld<any, any> | null = null;
  get world(): GgWorld<any, any> | null {
    return this._world;
  }

  protected _name: string = '';

  public get name(): string {
    return this._name;
  }

  public set name(value: string) {
    this._name = value;
  }

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

  protected _onSpawned$: Subject<void> = new Subject<void>();
  protected _onRemoved$: Subject<void> = new Subject<void>();

  public onSpawned(world: GgWorld<any, any>) {
    this._world = world;
    for (const c of this._children) {
      world.addEntity(c);
    }
    this._onSpawned$.next();
  }

  public onRemoved() {
    const world = this._world!;
    this._world = null;
    for (const c of this._children) {
      world.removeEntity(c);
    }
    this._onRemoved$.next();
  }

  // TODO add some flag to entity that it is disposed, and throw a normal error when trying to add such entity to world again
  public dispose(): void {
    this._onSpawned$.complete();
    this._onRemoved$.complete();
    for (const c of this._children) {
      c.dispose();
    }
  }
}
