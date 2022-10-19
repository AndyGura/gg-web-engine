import { IGg3dPhysicsWorld } from '@gg-web-engine/core';
import Ammo, * as AmmoModule from 'ammojs-typed';

export class Gg3dPhysicsWorld implements IGg3dPhysicsWorld {

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
  private broadphase: Ammo.btBroadphaseInterface | undefined;
  private solver: Ammo.btSequentialImpulseConstraintSolver | undefined;
  private gravityVector: Ammo.btVector3 | undefined;
  private _dynamicAmmoWorld: Ammo.btDiscreteDynamicsWorld | undefined;

  async init(): Promise<void> {
    this.ammoInstance = await AmmoModule.default.bind(AmmoModule)();
    this.collisionConfiguration = new this.ammo.btDefaultCollisionConfiguration();
    this.dispatcher = new this.ammo.btCollisionDispatcher(this.collisionConfiguration);
    this.broadphase = new this.ammo.btDbvtBroadphase();
    this.solver = new this.ammo.btSequentialImpulseConstraintSolver();
    this.gravityVector = new this.ammo.btVector3(0, 0, -9.82);

    this._dynamicAmmoWorld = new this.ammo.btDiscreteDynamicsWorld(
      this.dispatcher,
      this.broadphase,
      this.solver,
      this.collisionConfiguration,
    );
    this._dynamicAmmoWorld.setGravity(this.gravityVector);
  }

  simulate(delta: number): void {
    this._dynamicAmmoWorld?.stepSimulation(delta / 1000, 50);
  }

  dispose(): void {
    this.ammo.destroy(this._dynamicAmmoWorld);
    this.ammo.destroy(this.solver);
    this.ammo.destroy(this.broadphase);
    this.ammo.destroy(this.dispatcher);
    this.ammo.destroy(this.collisionConfiguration);
    this._dynamicAmmoWorld = this.solver =
      this.broadphase = this.dispatcher =
        this.collisionConfiguration = this.ammoInstance = undefined;
  }

}
