import { Gg3dWorld, IEntity, Point3, Point4, VisualTypeDocRepo3D } from '@gg-web-engine/core';
import { AmmoWorldComponent } from './ammo-world.component';
import Ammo from 'ammojs-typed';
import { ammoId } from '../ammo-utils';
import { AmmoPhysicsTypeDocRepo } from '../types';

export abstract class AmmoBodyComponent<T extends Ammo.btCollisionObject> {
  protected static nativeBodyReverseMap: Map<number, AmmoBodyComponent<any>> = new Map<
    number,
    AmmoBodyComponent<any>
  >();

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

  get nativeBody(): T {
    return this._nativeBody;
  }

  set nativeBody(value: T) {
    if (value == this._nativeBody) {
      return;
    }
    AmmoBodyComponent.nativeBodyReverseMap.delete(ammoId(this._nativeBody));
    this._nativeBody = value;
    AmmoBodyComponent.nativeBodyReverseMap.set(ammoId(value), this);
  }

  public name: string = '';

  abstract entity: IEntity | null;

  protected constructor(protected readonly world: AmmoWorldComponent, protected _nativeBody: T) {
    AmmoBodyComponent.nativeBodyReverseMap.set(ammoId(this.nativeBody), this);
  }

  abstract clone(): AmmoBodyComponent<T>;

  abstract addToWorld(world: Gg3dWorld<VisualTypeDocRepo3D, AmmoPhysicsTypeDocRepo>): void;

  abstract removeFromWorld(world: Gg3dWorld<VisualTypeDocRepo3D, AmmoPhysicsTypeDocRepo>): void;

  dispose(): void {
    try {
      this.ammo.destroy(this.nativeBody);
    } catch {
      // pass
    }
    AmmoBodyComponent.nativeBodyReverseMap.delete(ammoId(this.nativeBody));
  }
}
