import {
  Gg3dWorld,
  IDebugPhysicsDrawer,
  IPhysicsWorld3dComponent,
  Point3,
  Point4,
  VisualTypeDocRepo3D,
} from '@gg-web-engine/core';
import Ammo, * as AmmoModule from 'ammojs-typed';
import { AmmoFactory } from '../ammo-factory';
import { AmmoLoader } from '../ammo-loader';
import { AmmoDebugger, AmmoDebugMode } from '../ammo-debugger';
import { AmmoPhysicsTypeDocRepo } from '../types';

export class AmmoWorldComponent implements IPhysicsWorld3dComponent<AmmoPhysicsTypeDocRepo> {
  private _factory: AmmoFactory | null = null;
  public get factory(): AmmoFactory {
    if (!this._factory) {
      throw new Error('Ammo world not initialized');
    }
    return this._factory;
  }

  private _loader: AmmoLoader | null = null;
  public get loader(): AmmoLoader {
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
    if (this.gravityVector) {
      this.gravityVector.setValue(value.x, value.y, value.z);
      this._dynamicAmmoWorld?.setGravity(this.gravityVector);
    }
  }

  private _timeScale: number = 1;
  public get timeScale(): number {
    return this._timeScale;
  }

  public set timeScale(value: number) {
    this._timeScale = value;
  }
  private _debugger: AmmoDebugger | null = null;
  private _debugDrawer: IDebugPhysicsDrawer<Point3, Point4> | null = null;

  get physicsDebugViewActive(): boolean {
    return !!this._debugger;
  }

  private ammoInstance: typeof Ammo | undefined;

  public get ammo(): typeof Ammo {
    if (this.ammoInstance) {
      return this.ammoInstance;
    }
    throw 'Physics world not initialized!';
  }

  public get dynamicAmmoWorld(): Ammo.btDiscreteDynamicsWorld | undefined {
    return this._dynamicAmmoWorld;
  }

  private collisionConfiguration: Ammo.btDefaultCollisionConfiguration | undefined;
  private dispatcher: Ammo.btCollisionDispatcher | undefined;
  private ghostPairCallback: Ammo.btGhostPairCallback | undefined;
  private broadphase: Ammo.btBroadphaseInterface | undefined;
  private solver: Ammo.btSequentialImpulseConstraintSolver | undefined;
  private gravityVector: Ammo.btVector3 | undefined;
  protected _dynamicAmmoWorld: Ammo.btDiscreteDynamicsWorld | undefined;

  async init(): Promise<void> {
    this.ammoInstance = await AmmoModule.default.bind(AmmoModule)();
    this.collisionConfiguration = new this.ammo.btDefaultCollisionConfiguration();
    this.dispatcher = new this.ammo.btCollisionDispatcher(this.collisionConfiguration);
    this.broadphase = new this.ammo.btDbvtBroadphase();
    this.ghostPairCallback = new this.ammo.btGhostPairCallback();
    this.solver = new this.ammo.btSequentialImpulseConstraintSolver();
    this.gravityVector = new this.ammo.btVector3(this._gravity.x, this._gravity.y, this._gravity.z);

    this._dynamicAmmoWorld = new this.ammo.btDiscreteDynamicsWorld(
      this.dispatcher,
      this.broadphase,
      this.solver,
      this.collisionConfiguration,
    );
    this._dynamicAmmoWorld.getPairCache().setInternalGhostPairCallback(this.ghostPairCallback);
    this._dynamicAmmoWorld.setGravity(this.gravityVector);
    this._factory = new AmmoFactory(this);
    this._loader = new AmmoLoader(this);
  }

  simulate(delta: number): void {
    this._dynamicAmmoWorld?.stepSimulation((this._timeScale * delta) / 1000, 100, this._timeScale * 0.01);
    if (this._debugger) {
      this._debugger.update();
    }
  }

  startDebugger(
    world: Gg3dWorld<VisualTypeDocRepo3D, AmmoPhysicsTypeDocRepo>,
    drawer: IDebugPhysicsDrawer<Point3, Point4>,
  ): void {
    if (!this._debugger) {
      this._debugger = new AmmoDebugger(this, drawer);
      this.dynamicAmmoWorld?.setDebugDrawer(this._debugger.ammoInstance);
    }
    this._debugger!.setDebugMode(AmmoDebugMode.DrawWireframe);
    this._debugDrawer = drawer;
    this._debugDrawer.addToWorld(world);
  }

  stopDebugger(world: Gg3dWorld<VisualTypeDocRepo3D, AmmoPhysicsTypeDocRepo>): void {
    if (this._debugger) {
      this.dynamicAmmoWorld?.setDebugDrawer(null!);
      this.ammo.destroy(this._debugger.ammoInstance);
      this._debugger = null;
    }
    if (this._debugDrawer) {
      this._debugDrawer!.removeFromWorld(world);
      this._debugDrawer!.dispose();
      this._debugDrawer = null;
    }
  }

  dispose(): void {
    this.ammo.destroy(this._dynamicAmmoWorld);
    this.ammo.destroy(this.solver);
    this.ammo.destroy(this.broadphase);
    this.ammo.destroy(this.dispatcher);
    this.ammo.destroy(this.collisionConfiguration);
    if (this._debugger) {
      this.ammo.destroy(this._debugger.ammoInstance);
    }
    this._dynamicAmmoWorld =
      this.solver =
      this.broadphase =
      this.dispatcher =
      this.collisionConfiguration =
      this.ammoInstance =
        undefined;
  }
}
