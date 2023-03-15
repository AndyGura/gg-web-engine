import { IGg3dBody, Point3, Point4, Gg3dEntity } from '@gg-web-engine/core';
import { Gg3dPhysicsWorld } from '../gg-3d-physics-world';
import Ammo from 'ammojs-typed';
import { ammoId } from '../../ammo-utils';

export abstract class BaseAmmoGGBody<T extends Ammo.btCollisionObject> implements IGg3dBody {

  protected static nativeBodyReverseMap: Map<number, IGg3dBody> = new Map<number, IGg3dBody>();

  protected get ammo(): typeof Ammo {
    return this.world.ammo;
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
  get nativeBody(): T {
    return this._nativeBody;
  }

  set nativeBody(value: T) {
    if (value == this._nativeBody) {
      return;
    }
    BaseAmmoGGBody.nativeBodyReverseMap.delete(ammoId(this._nativeBody));
    this._nativeBody = value;
    BaseAmmoGGBody.nativeBodyReverseMap.set(ammoId(value), this);
  }

  public name: string = '';

  abstract entity: Gg3dEntity | null;

  protected constructor(
    protected readonly world: Gg3dPhysicsWorld,
    protected _nativeBody: T,
  ) {
    BaseAmmoGGBody.nativeBodyReverseMap.set(ammoId(this.nativeBody), this);
  }

  abstract clone(): BaseAmmoGGBody<T>;

  abstract addToWorld(world: Gg3dPhysicsWorld): void;

  abstract removeFromWorld(world: Gg3dPhysicsWorld): void;

  dispose(): void {
    try {
      this.ammo.destroy(this.nativeBody);
    } catch {
      // pass
    }
    BaseAmmoGGBody.nativeBodyReverseMap.delete(ammoId(this.nativeBody));
  }

  abstract resetMotion(): void;

}
