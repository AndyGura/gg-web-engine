import { Gg3dWorld, GgDebugPhysicsDrawer, IGg3dPhysicsWorld, Point3, Point4 } from '@gg-web-engine/core';
import { Gg3dBodyFactory } from './gg-3d-body-factory';
import { Gg3dBodyLoader } from './gg-3d-body-loader';
import { EventQueue, Vector3, World } from '@dimforge/rapier3d';
import { Gg3dBody } from './bodies/gg-3d-body';

export class Gg3dPhysicsWorld implements IGg3dPhysicsWorld {
  private _factory: Gg3dBodyFactory | null = null;
  public get factory(): Gg3dBodyFactory {
    if (!this._factory) {
      throw new Error('Ammo world not initialized');
    }
    return this._factory;
  }

  private _loader: Gg3dBodyLoader | null = null;
  public get loader(): Gg3dBodyLoader {
    if (!this._loader) {
      throw new Error('Ammo world not initialized');
    }
    return this._loader;
  }

  private _gravity: Point3 = { x: 0, y: 0, z: -9.82 };
  public get gravity(): Point3 {
    return this._gravity;
  }

  public set gravity(value: Point3) {
    this._gravity = value;
    if (this.nativeWorld) {
      this.nativeWorld.gravity.x = value.x;
      this.nativeWorld.gravity.y = value.y;
      this.nativeWorld.gravity.z = value.z;
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

  protected _nativeWorld: World | undefined;
  public get nativeWorld(): World | undefined {
    return this._nativeWorld;
  }
  public readonly eventQueue: EventQueue = new EventQueue(true);

  public readonly handleIdEntityMap: Map<number, Gg3dBody> = new Map();

  async init(): Promise<void> {
    this._nativeWorld = new World(new Vector3(this._gravity.x, this._gravity.y, this._gravity.z));
    this._factory = new Gg3dBodyFactory(this);
    this._loader = new Gg3dBodyLoader(this);
  }

  simulate(delta: number): void {
    this._nativeWorld!.timestep = (this.timeScale * delta) / 1000;
    this._nativeWorld?.step(this.eventQueue);
  }

  startDebugger(world: Gg3dWorld, drawer: GgDebugPhysicsDrawer<Point3, Point4>): void {
    throw new Error('Not implemented');
  }

  stopDebugger(world: Gg3dWorld): void {
    throw new Error('Not implemented');
  }

  dispose(): void {
    this._nativeWorld?.free();
  }
}
