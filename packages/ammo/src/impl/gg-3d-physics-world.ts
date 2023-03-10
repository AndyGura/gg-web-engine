import { Gg3dWorld, GgDebugPhysicsDrawer, IGg3dPhysicsWorld, Point3, Point4 } from '@gg-web-engine/core';
import Ammo, * as AmmoModule from 'ammojs-typed';
import { Gg3dBodyFactory } from './gg-3d-body-factory';
import { Gg3dBodyLoader } from './gg-3d-body-loader';
import { AmmoDebugger, AmmoDebugMode } from '../ammo-debugger';

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
  private _debugDrawer: GgDebugPhysicsDrawer<Point3, Point4> | null = null;

  get debuggerActive(): boolean {
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
  private _dynamicAmmoWorld: Ammo.btDiscreteDynamicsWorld | undefined;

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
    this._factory = new Gg3dBodyFactory(this);
    this._loader = new Gg3dBodyLoader(this);
  }

  simulate(delta: number): void {
    // FIXME ammo.js jitters when calculating too small step (with timescale 0.25 and below)
    this._dynamicAmmoWorld?.stepSimulation(this._timeScale * delta / 1000, 50);
    if (this._debugger) {
      this._debugger.update();
    }
  }

  startDebugger(world: Gg3dWorld, drawer: GgDebugPhysicsDrawer<Point3, Point4>): void {
    if (!this._debugger) {
      this._debugger = new AmmoDebugger(this, drawer);
      this.dynamicAmmoWorld?.setDebugDrawer(this._debugger.ammoInstance);
    }
    this._debugger!.setDebugMode(AmmoDebugMode.DrawWireframe);
    this._debugDrawer = drawer;
    this._debugDrawer.addToWorld(world.visualScene);
  }

  stopDebugger(world: Gg3dWorld): void {
    if (this._debugger) {
      this.dynamicAmmoWorld?.setDebugDrawer(null as any);
      this.ammo.destroy(this._debugger.ammoInstance);
      this._debugger = null;
    }
    if (this._debugDrawer) {
      this._debugDrawer!.removeFromWorld(world.visualScene);
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
    this._dynamicAmmoWorld = this.solver =
      this.broadphase = this.dispatcher =
        this.collisionConfiguration = this.ammoInstance = undefined;
  }

}
