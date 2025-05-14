import { BitMask, CollisionGroup, IEntity, Point3, Point4, Shape3DDescriptor } from '@gg-web-engine/core';
import { AmmoWorldComponent } from './ammo-world.component';
import Ammo from '../ammo.js/ammo';
import { AmmoGgWorld } from '../types';

export abstract class AmmoBodyComponent<T extends Ammo.btCollisionObject> {
  public static nativeBodyReverseMap: Map<number, AmmoBodyComponent<any>> = new Map<number, AmmoBodyComponent<any>>();

  public get position(): Point3 {
    const origin = this.nativeBody.getWorldTransform().getOrigin();
    return { x: origin.x(), y: origin.y(), z: origin.z() };
  }

  public set position(value: Point3) {
    const transform = this.nativeBody.getWorldTransform();
    transform.setOrigin(new Ammo.btVector3(value.x, value.y, value.z));
    this.nativeBody.setWorldTransform(transform);
  }

  public get rotation(): Point4 {
    const quaternion = this.nativeBody.getWorldTransform().getRotation();
    return { x: quaternion.x(), y: quaternion.y(), z: quaternion.z(), w: quaternion.w() };
  }

  public set rotation(value: Point4) {
    const transform = this.nativeBody.getWorldTransform();
    transform.setRotation(new Ammo.btQuaternion(value.x, value.y, value.z, value.w));
    this.nativeBody.setWorldTransform(transform);
  }

  public name: string = '';

  abstract entity: IEntity | null;

  get nativeBody(): T {
    return this._nativeBody;
  }

  set nativeBody(value: T) {
    if (value == this._nativeBody) {
      return;
    }
    AmmoBodyComponent.nativeBodyReverseMap.delete(Ammo.getPointer(this._nativeBody));
    this._nativeBody = value;
    AmmoBodyComponent.nativeBodyReverseMap.set(Ammo.getPointer(value), this);
  }

  protected addedToWorld: boolean = false;
  protected _interactWithCGsMask = BitMask.full(16);
  protected _ownCGsMask = BitMask.full(16);

  get interactWithCollisionGroups(): ReadonlyArray<CollisionGroup> {
    return BitMask.unpack(this._interactWithCGsMask, 16);
  }

  abstract refreshCG(): void;

  set interactWithCollisionGroups(value: ReadonlyArray<CollisionGroup> | 'all') {
    let mask;
    if (value === 'all') {
      mask = BitMask.full(16);
    } else {
      mask = BitMask.pack(value, 16);
    }
    if (this._interactWithCGsMask !== mask) {
      this._interactWithCGsMask = mask;
      if (this.addedToWorld) {
        this.refreshCG();
      }
    }
  }

  get ownCollisionGroups(): ReadonlyArray<CollisionGroup> {
    return BitMask.unpack(this._ownCGsMask, 16);
  }

  set ownCollisionGroups(value: ReadonlyArray<CollisionGroup> | 'all') {
    let mask;
    if (value === 'all') {
      mask = BitMask.full(16);
    } else {
      mask = BitMask.pack(value, 16);
    }
    if (this._ownCGsMask !== mask) {
      this._ownCGsMask = mask;
      if (this.addedToWorld) {
        this.refreshCG();
      }
    }
  }

  protected constructor(
    protected readonly world: AmmoWorldComponent,
    protected _nativeBody: T,
    public readonly shape: Shape3DDescriptor,
  ) {
    AmmoBodyComponent.nativeBodyReverseMap.set(Ammo.getPointer(this.nativeBody), this);
    this.ownCollisionGroups = this.interactWithCollisionGroups = [world.mainCollisionGroup];
  }

  abstract clone(): AmmoBodyComponent<T>;

  addToWorld(world: AmmoGgWorld): void {
    if (world.physicsWorld != this.world) {
      throw new Error('Ammo bodies cannot be shared between different worlds');
    }
    this.addedToWorld = true;
    this.world.added$.next(this as any);
  }

  removeFromWorld(world: AmmoGgWorld): void {
    if (world.physicsWorld != this.world) {
      throw new Error('Ammo bodies cannot be shared between different worlds');
    }
    this.addedToWorld = false;
    this.world.removed$.next(this as any);
  }

  dispose(): void {
    try {
      Ammo.destroy(this.nativeBody);
    } catch {
      // pass
    }
    AmmoBodyComponent.nativeBodyReverseMap.delete(Ammo.getPointer(this.nativeBody));
  }
}
