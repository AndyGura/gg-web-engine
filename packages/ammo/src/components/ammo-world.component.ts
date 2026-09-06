import {
  BitMask,
  CollisionGroup,
  IPhysicsWorld3dComponent,
  Point3,
  RaycastOptions,
  RaycastResult,
} from '@gg-web-engine/core';
import { Subject } from 'rxjs';
import Ammo from '../ammo.js/ammo';
import { AmmoFactory } from '../ammo-factory';
import { AmmoLoader } from '../ammo-loader';
import { AmmoPhysicsTypeDocRepo } from '../types';
import { AmmoRigidBodyComponent } from './ammo-rigid-body.component';
import { AmmoTriggerComponent } from './ammo-trigger.component';
import { AmmoBodyComponent } from './ammo-body.component';

export class AmmoWorldComponent implements IPhysicsWorld3dComponent<AmmoPhysicsTypeDocRepo> {
  private _factory: AmmoFactory | null = null;
  public get factory(): AmmoFactory {
    if (!this._factory) {
      throw new Error('Ammo world not initialized');
    }
    return this._factory;
  }

  public readonly afterTick$: Subject<void> = new Subject<void>();
  public readonly added$: Subject<AmmoRigidBodyComponent | AmmoTriggerComponent> = new Subject();
  public readonly removed$: Subject<AmmoRigidBodyComponent | AmmoTriggerComponent> = new Subject();
  public readonly children: (AmmoRigidBodyComponent | AmmoTriggerComponent)[] = [];

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

  readonly mainCollisionGroup: CollisionGroup = 0;

  public maxSubSteps?: number = 100;
  public fixedTimeStep?: number = 0.01;

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

  constructor() {
    this.added$.subscribe(c => this.children.push(c));
    this.removed$.subscribe(c => this.children.splice(this.children.indexOf(c), 1));
  }

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
    this._dynamicAmmoWorld?.stepSimulation(
      delta / 1000,
      this.maxSubSteps || undefined,
      this.fixedTimeStep || undefined,
    );
    this.afterTick$.next();
  }

  protected lockedCollisionGroups: number[] = [];

  registerCollisionGroup(): CollisionGroup {
    for (let i = 1; i < 16; i++) {
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

  raycast(options: RaycastOptions<Point3>): RaycastResult<Point3, AmmoRigidBodyComponent | AmmoTriggerComponent> {
    if (!this._dynamicAmmoWorld) {
      return { hasHit: false };
    }
    const from = new Ammo.btVector3(options.from.x, options.from.y, options.from.z);
    const to = new Ammo.btVector3(options.to.x, options.to.y, options.to.z);

    const rayCallback = new Ammo.ClosestRayResultCallback(from, to);

    if (options.collisionFilterGroups) {
      rayCallback.set_m_collisionFilterGroup(BitMask.pack(options.collisionFilterGroups, 16));
    }
    if (options.collisionFilterMask !== undefined) {
      rayCallback.set_m_collisionFilterMask(BitMask.pack(options.collisionFilterMask, 16));
    }
    this._dynamicAmmoWorld.rayTest(from, to, rayCallback);

    const hasHit = rayCallback.hasHit();

    const result: RaycastResult<Point3, any> = { hasHit };

    if (hasHit) {
      result.hitBody = AmmoBodyComponent.nativeBodyReverseMap.get(Ammo.getPointer(rayCallback.get_m_collisionObject()));
      const hitPointAmmo = rayCallback.get_m_hitPointWorld();
      result.hitPoint = {
        x: hitPointAmmo.x(),
        y: hitPointAmmo.y(),
        z: hitPointAmmo.z(),
      };
      const hitNormalAmmo = rayCallback.get_m_hitNormalWorld();
      result.hitNormal = {
        x: hitNormalAmmo.x(),
        y: hitNormalAmmo.y(),
        z: hitNormalAmmo.z(),
      };
      const dx = result.hitPoint.x - options.from.x;
      const dy = result.hitPoint.y - options.from.y;
      const dz = result.hitPoint.z - options.from.z;
      result.hitDistance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    Ammo.destroy(from);
    Ammo.destroy(to);
    Ammo.destroy(rayCallback);

    return result;
  }

  dispose(): void {
    this.afterTick$.complete();
    Ammo.destroy(this._dynamicAmmoWorld);
    Ammo.destroy(this.solver);
    Ammo.destroy(this.broadphase);
    Ammo.destroy(this.dispatcher);
    Ammo.destroy(this.collisionConfiguration);
    this._dynamicAmmoWorld = this.solver = this.broadphase = this.dispatcher = this.collisionConfiguration = undefined;
  }
}
