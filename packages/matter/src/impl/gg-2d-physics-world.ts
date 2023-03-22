import { IGg2dPhysicsWorld, GgDebugPhysicsDrawer, Point2, Gg2dWorld } from '@gg-web-engine/core';
import { Engine, World } from 'matter-js';
import { Gg2dBodyFactory } from './gg-2d-body-factory';

export class Gg2dPhysicsWorld implements IGg2dPhysicsWorld {

  private matterEngine: Engine | null = null;

  public get matterWorld(): World | null {
    return this.matterEngine && this.matterEngine.world;
  }

  public readonly factory: Gg2dBodyFactory = new Gg2dBodyFactory();

  private _gravity: Point2 = {x: 0, y: 9.82 };
  public get gravity(): Point2 {
    return this._gravity;
  }
  public set gravity(value: Point2) {
    this._gravity = value;
    if (this.matterEngine) {
      this.matterEngine.gravity.x = this._gravity.x;
      this.matterEngine.gravity.y = this._gravity.y;
    }
  }

  private _timeScale: number = 1;
  public get timeScale(): number {
    return this._timeScale;
  }
  public set timeScale(value: number) {
    this._timeScale = value;
  }

  public get physicsDebugViewActive(): boolean {
    return false;
  }

  async init(): Promise<void> {
    this.matterEngine = Engine.create({ gravity: { ...this._gravity, scale: 0.0001 }});
  }

  simulate(delta: number): void {
    Engine.update(this.matterEngine!, this._timeScale * delta, );
  }

  startDebugger(world: Gg2dWorld, drawer: GgDebugPhysicsDrawer<Point2, number>): void {
    // TODO
    throw new Error('Matter.js DebugDrawer not implemented');
  }

  stopDebugger(): void {
    // TODO
    throw new Error('Matter.js DebugDrawer not implemented');
  }

  dispose(): void {
    Engine.clear(this.matterEngine!);
  }

}
