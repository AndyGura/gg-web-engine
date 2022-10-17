import { GgWorld } from '../gg-world';

export abstract class GgEntity {

  get world(): GgWorld<any, any> | null {
    return this._world;
  }
  private _world: GgWorld<any, any> | null = null;

  public onSpawned(world: GgWorld<any, any>) {
    this._world = world;
  }

  public onRemoved() {
    this._world = null;
  }

  abstract dispose(): void

}
