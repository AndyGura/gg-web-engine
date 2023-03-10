import { GgPositionable3dEntity, IGg3dBody, IGg3dTrigger, Point3, Point4 } from '@gg-web-engine/core';
import { Gg3dPhysicsWorld } from './gg-3d-physics-world';
import { NEVER, Observable, Subject, map } from 'rxjs';
import Ammo from 'ammojs-typed';

export class Gg3dTrigger implements IGg3dBody, IGg3dTrigger {
  // FIXME copy-paste from Gg3dBody, because there we strictly bound to btRigidBody. Probably should switch to btCollisionObject
  protected get ammo(): typeof Ammo {
    return this.world.ammo as any;
  }

  public get position(): Point3 {
    const origin = this.nativeBody.getWorldTransform().getOrigin();
    return { x: origin.x(), y: origin.y(), z: origin.z() };
  }

  public set position(value: Point3) {
    const transform = this.nativeBody.getWorldTransform();
    transform.setOrigin(new this.ammo.btVector3(value.x, value.y, value.z));
    this.nativeBody.setWorldTransform(transform);
  }

  public get rotation(): Point4 {
    const quaternion = this.nativeBody.getWorldTransform().getRotation();
    return { x: quaternion.x(), y: quaternion.y(), z: quaternion.z(), w: quaternion.w() };
  }

  public set rotation(value: Point4) {
    const transform = this.nativeBody.getWorldTransform();
    transform.setRotation(new this.ammo.btQuaternion(value.x, value.y, value.z, value.w));
    this.nativeBody.setWorldTransform(transform);
  }

  public get scale(): Point3 {
    // hmm, is it even possible to be different?
    return { x: 1, y: 1, z: 1 };
  }

  public name: string = '';

  get onEntityEntered(): Observable<GgPositionable3dEntity> {
    return this.onEnter$.asObservable() as any;
  }

  get onEntityLeft(): Observable<GgPositionable3dEntity> {
    return this.onLeft$.asObservable() as any;
  }

  constructor(
    protected readonly world: Gg3dPhysicsWorld,
    public nativeBody: Ammo.btPairCachingGhostObject,
  ) {
  }

  private readonly onEnter$: Subject<Ammo.btCollisionObject> = new Subject<Ammo.btCollisionObject>();
  private readonly onLeft$: Subject<Ammo.btCollisionObject> = new Subject<Ammo.btCollisionObject>();
  private readonly overlaps: Set<Ammo.btCollisionObject> = new Set<Ammo.btCollisionObject>();

  checkOverlaps(): void {
    const numOverlappingObjects = this.nativeBody.getNumOverlappingObjects();
    const newOverlaps = new Set(new Array(numOverlappingObjects).fill(null).map((_, i) => this.nativeBody.getOverlappingObject(i)));
    for (const overlap of this.overlaps.keys()) {
      if (!newOverlaps.has(overlap)) {
        this.overlaps.delete(overlap);
        this.onLeft$.next(overlap);
      } else {
        newOverlaps.delete(overlap);
      }
    }
    for (const newOverlap of newOverlaps) {
      this.overlaps.add(newOverlap);
      this.onEnter$.next(newOverlap);
    }
  }


  addToWorld(world: Gg3dPhysicsWorld) {
    if (world != this.world) {
      throw new Error('Ammo triggers cannot be shared between different worlds');
    }
    world.dynamicAmmoWorld?.addCollisionObject(this.nativeBody);
    this.overlaps.clear();
  }

  removeFromWorld(world: Gg3dPhysicsWorld): void {
    for (const body of this.overlaps) {
      this.onLeft$.next(body);
    }
    this.overlaps.clear();
    world.dynamicAmmoWorld?.removeCollisionObject(this.nativeBody);
  }

  dispose(): void {
    try {
      this.ammo.destroy(this.nativeBody);
    } catch {
      // pass
    }
    this.overlaps.clear();
    this.onEnter$.complete();
    this.onLeft$.complete();
  }

  resetMotion(): void {
  }
}
