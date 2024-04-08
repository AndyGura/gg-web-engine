import {
  CollisionGroup,
  Gg3dWorld,
  IDebugPhysicsDrawer,
  IPhysicsWorld3dComponent,
  Point3,
  Point4,
  VisualTypeDocRepo3D,
} from '@gg-web-engine/core';
import { Subject } from 'rxjs';
import Ammo from '../ammo.js/ammo';
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

  public afterTick$: Subject<void> = new Subject<void>();

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
    await Ammo.bind(Ammo)(Ammo);
    this.collisionConfiguration = new Ammo.btDefaultCollisionConfiguration();
    this.dispatcher = new Ammo.btCollisionDispatcher(this.collisionConfiguration);
    this.broadphase = new Ammo.btDbvtBroadphase();
    this.ghostPairCallback = new Ammo.btGhostPairCallback();
    this.solver = new Ammo.btSequentialImpulseConstraintSolver();
    this.gravityVector = new Ammo.btVector3(this._gravity.x, this._gravity.y, this._gravity.z);

    this._dynamicAmmoWorld = new Ammo.btDiscreteDynamicsWorld(
      this.dispatcher,
      this.broadphase!,
      this.solver,
      this.collisionConfiguration,
    );
    // fix the problem when dynamic objects clip in the static/kinematic objects, moved manually.
    // the problem is introduced in bullet here: https://github.com/bulletphysics/bullet3/commit/96c1ee42565d951347e515e40f41f71d0963d2d0
    this._dynamicAmmoWorld.getSolverInfo().set_m_erp2(0.8);
    this._dynamicAmmoWorld.getPairCache().setInternalGhostPairCallback(this.ghostPairCallback);
    this._dynamicAmmoWorld.setGravity(this.gravityVector);
    this._factory = new AmmoFactory(this);
    this._loader = new AmmoLoader(this);
  }

  simulate(delta: number): void {
    this._dynamicAmmoWorld?.stepSimulation((this._timeScale * delta) / 1000, 100, this._timeScale * 0.01);
    this.afterTick$.next();
    if (this._debugger) {
      this._debugger.update();
    }
  }

  protected lockedCollisionGroups: number[] = [];

  registerCollisionGroup(): CollisionGroup {
    for (let i = 0; i < 16; i++) {
      if (!this.lockedCollisionGroups.includes(i)) {
        this.lockedCollisionGroups.push(i);
        return i;
      }
    }
    throw new Error('App tries to register 17th collision group, but ammo.js supports only 16');
  }

  deregisterCollisionGroup(group: CollisionGroup): void {
    this.lockedCollisionGroups = this.lockedCollisionGroups.filter(x => x !== group);
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
      Ammo.destroy(this._debugger.ammoInstance);
      this._debugger = null;
    }
    if (this._debugDrawer) {
      this._debugDrawer!.removeFromWorld(world);
      this._debugDrawer!.dispose();
      this._debugDrawer = null;
    }
  }

  dispose(): void {
    this.afterTick$.complete();
    Ammo.destroy(this._dynamicAmmoWorld);
    Ammo.destroy(this.solver);
    Ammo.destroy(this.broadphase);
    Ammo.destroy(this.dispatcher);
    Ammo.destroy(this.collisionConfiguration);
    if (this._debugger) {
      Ammo.destroy(this._debugger.ammoInstance);
    }
    this._dynamicAmmoWorld = this.solver = this.broadphase = this.dispatcher = this.collisionConfiguration = undefined;
  }
}
