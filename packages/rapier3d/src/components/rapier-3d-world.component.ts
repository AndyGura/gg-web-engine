import { Gg3dWorld, IDebugPhysicsDrawer, IPhysicsWorld3dComponent, Point3, Point4 } from '@gg-web-engine/core';
import { EventQueue, Vector3, World } from '@dimforge/rapier3d';
import { Rapier3dRigidBodyComponent } from './rapier-3d-rigid-body.component';
import { Rapier3dFactory } from '../rapier-3d-factory';
import { Rapier3dLoader } from '../rapier-3d-loader';

export class Rapier3dWorldComponent implements IPhysicsWorld3dComponent {
  private _factory: Rapier3dFactory | null = null;
  public get factory(): Rapier3dFactory {
    if (!this._factory) {
      throw new Error('Ammo world not initialized');
    }
    return this._factory;
  }

  private _loader: Rapier3dLoader | null = null;
  public get loader(): Rapier3dLoader {
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

  public readonly handleIdEntityMap: Map<number, Rapier3dRigidBodyComponent> = new Map();

  async init(): Promise<void> {
    this._nativeWorld = new World(new Vector3(this._gravity.x, this._gravity.y, this._gravity.z));
    this._factory = new Rapier3dFactory(this);
    this._loader = new Rapier3dLoader(this);
  }

  simulate(delta: number): void {
    this._nativeWorld!.timestep = (this.timeScale * delta) / 1000;
    this._nativeWorld?.step(this.eventQueue);
  }

  startDebugger(world: Gg3dWorld, drawer: IDebugPhysicsDrawer<Point3, Point4>): void {
    // TODO
    throw new Error('rapier-3d DebugDrawer not implemented');
  }

  stopDebugger(): void {
    // TODO
    throw new Error('rapier-3d DebugDrawer not implemented');
  }

  dispose(): void {
    this._nativeWorld?.free();
  }
}
