import { Gg2dWorld, IDebugPhysicsDrawer, IPhysicsWorld2dComponent, Pnt2, Point2 } from '@gg-web-engine/core';
import { init, EventQueue, Vector2, World } from '@dimforge/rapier2d-compat';
import { Rapier2dRigidBodyComponent } from './rapier-2d-rigid-body.component';
import { Rapier2dFactory } from '../rapier-2d-factory';

export class Rapier2dWorldComponent implements IPhysicsWorld2dComponent {
  private _factory: Rapier2dFactory | null = null;
  public get factory(): Rapier2dFactory {
    if (!this._factory) {
      throw new Error('Rapier2d world not initialized');
    }
    return this._factory;
  }

  private readonly unitScale: number = 100; // TODO abstractize somehow, hardcoded now
  private _gravity: Point2 = Pnt2.scalarMult({ x: 0, y: 9.82 }, this.unitScale);
  public get gravity(): Point2 {
    return Pnt2.scalarMult(this._gravity, 1 / this.unitScale);
  }

  public set gravity(value: Point2) {
    this._gravity = Pnt2.scalarMult(value, this.unitScale);
    if (this.nativeWorld) {
      this.nativeWorld.gravity.x = this._gravity.x;
      this.nativeWorld.gravity.y = this._gravity.y;
    }
  }

  private _timeScale: number = 1;
  public get timeScale(): number {
    return this._timeScale;
  }

  public set timeScale(value: number) {
    this._timeScale = value;
  }

  get physicsDebugViewActive(): boolean {
    return false;
  }

  protected _nativeWorld: World | null = null;
  public get nativeWorld(): World {
    if (!this._nativeWorld) {
      throw new Error('Rapier2d world not initialized');
    }
    return this._nativeWorld;
  }

  private _eventQueue: EventQueue | null = null;
  public get eventQueue(): EventQueue {
    if (!this._eventQueue) {
      throw new Error('Rapier2d world not initialized');
    }
    return this._eventQueue;
  }

  public readonly handleIdEntityMap: Map<number, Rapier2dRigidBodyComponent> = new Map();

  async init(): Promise<void> {
    await init();
    this._eventQueue = new EventQueue(true);
    this._nativeWorld = new World(new Vector2(this._gravity.x, this._gravity.y));
    this._factory = new Rapier2dFactory(this);
  }

  simulate(delta: number): void {
    this._nativeWorld!.timestep = (this.timeScale * delta) / 1000;
    this._nativeWorld?.step(this.eventQueue);
  }

  startDebugger(world: Gg2dWorld, drawer: IDebugPhysicsDrawer<Point2, number>): void {
    // TODO
    throw new Error('rapier-2d DebugDrawer not implemented');
  }

  stopDebugger(): void {
    // TODO
    throw new Error('rapier-2d DebugDrawer not implemented');
  }

  dispose(): void {
    this._nativeWorld?.free();
  }
}
