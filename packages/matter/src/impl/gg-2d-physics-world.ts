import { IGg2dPhysicsWorld } from '@gg-web-engine/core';
import { Engine, World } from 'matter-js';

export class Gg2dPhysicsWorld implements IGg2dPhysicsWorld {

  private matterEngine: Engine | null = null;

  public get matterWorld(): World | null {
    return this.matterEngine && this.matterEngine.world;
  }

  async init(): Promise<void> {
    this.matterEngine = Engine.create({ gravity: { x: 0, y: 9.82, scale: 0.0001 }});
  }

  simulate(delta: number): void {
    Engine.update(this.matterEngine!, delta, );
  }

  dispose(): void {
    Engine.clear(this.matterEngine!);
  }

}
