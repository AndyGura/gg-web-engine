import { CollisionGroup, IBodyComponent, IPhysicsWorld3dComponent, Point3, Point4 } from '@gg-web-engine/core';
import { EventQueue, init, Vector3, World } from '@dimforge/rapier3d-compat';
import { Rapier3dRigidBodyComponent } from './rapier-3d-rigid-body.component';
import { Rapier3dFactory } from '../rapier-3d-factory';
import { Rapier3dLoader } from '../rapier-3d-loader';
import { Rapier3dPhysicsTypeDocRepo } from '../types';
import { Subject } from 'rxjs';

export class Rapier3dWorldComponent implements IPhysicsWorld3dComponent<Rapier3dPhysicsTypeDocRepo> {
  private _factory: Rapier3dFactory | null = null;
  public get factory(): Rapier3dFactory {
    if (!this._factory) {
      throw new Error('Rapier3d world not initialized');
    }
    return this._factory;
  }

  private _loader: Rapier3dLoader | null = null;
  public get loader(): Rapier3dLoader {
    if (!this._loader) {
      throw new Error('Rapier3d world not initialized');
    }
    return this._loader;
  }

  public readonly added$: Subject<
    Rapier3dRigidBodyComponent | IBodyComponent<Point3, Point4, Rapier3dPhysicsTypeDocRepo>
  > = new Subject();
  public readonly removed$: Subject<
    Rapier3dRigidBodyComponent | IBodyComponent<Point3, Point4, Rapier3dPhysicsTypeDocRepo>
  > = new Subject();

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

  protected _nativeWorld: World | null = null;
  public get nativeWorld(): World {
    if (!this._nativeWorld) {
      throw new Error('Rapier3d world not initialized');
    }
    return this._nativeWorld;
  }

  private _eventQueue: EventQueue | null = null;
  public get eventQueue(): EventQueue {
    if (!this._eventQueue) {
      throw new Error('Rapier3d world not initialized');
    }
    return this._eventQueue;
  }

  public readonly handleIdEntityMap: Map<number, Rapier3dRigidBodyComponent> = new Map();

  async init(): Promise<void> {
    await init();
    this._eventQueue = new EventQueue(true);
    this._nativeWorld = new World(new Vector3(this._gravity.x, this._gravity.y, this._gravity.z));
    this._factory = new Rapier3dFactory(this);
    this._loader = new Rapier3dLoader(this);
  }

  simulate(delta: number): void {
    this._nativeWorld!.timestep = delta / 1000;
    this._nativeWorld?.step(this.eventQueue);
  }

  protected lockedCollisionGroups: number[] = [];

  registerCollisionGroup(): CollisionGroup {
    for (let i = 0; i < 16; i++) {
      if (!this.lockedCollisionGroups.includes(i)) {
        this.lockedCollisionGroups.push(i);
        return i;
      }
    }
    throw new Error('App tries to register 17th collision group, but rapier 3D supports only 16');
  }

  deregisterCollisionGroup(group: CollisionGroup): void {
    this.lockedCollisionGroups = this.lockedCollisionGroups.filter(x => x !== group);
  }

  dispose(): void {
    this._nativeWorld?.free();
  }
}
