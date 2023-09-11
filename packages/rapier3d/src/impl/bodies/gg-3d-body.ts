import { Gg3dPhysicsWorld } from '../gg-3d-physics-world';
import { Body3DOptions, Gg3dEntity, IGg3dBody, Pnt3, Point3, Point4, Qtrn } from '@gg-web-engine/core';
import { Collider, ColliderDesc, Quaternion, RigidBody, RigidBodyDesc, Vector3 } from '@dimforge/rapier3d';

export class Gg3dBody implements IGg3dBody {

  public get position(): Point3 {
    return Pnt3.clone(this.nativeBody ? this.nativeBody.translation() : this._bodyDescr.translation);
  }

  public set position(value: Point3) {
    if (this.nativeBody) {
      this.nativeBody.setTranslation(new Vector3(value.x, value.y, value.z), false);
    } else {
      this._bodyDescr.setTranslation(value.x, value.y, value.z);
    }
  }

  public get rotation(): Point4 {
    return Qtrn.clone(this.nativeBody ? this.nativeBody.rotation() : this._bodyDescr.rotation);
  }

  public set rotation(value: Point4) {
    if (this.nativeBody) {
      this.nativeBody.setRotation(new Quaternion(value.x, value.y, value.z, value.w), false);
    } else {
      this._bodyDescr.setRotation(new Quaternion(value.x, value.y, value.z, value.w));
    }
  }

  public get scale(): Point3 {
    // hmm, is it even possible to be different?
    return { x: 1, y: 1, z: 1 };
  }

  protected _nativeBody: RigidBody | null = null;
  protected _nativeBodyCollider: Collider | null = null;

  get nativeBody(): RigidBody | null {
    return this._nativeBody;
  }

  set nativeBody(value: RigidBody | null) {
    if (value == this._nativeBody || !value) {
      return;
    }
    this._nativeBody = value;
  }

  public name: string = '';

  public entity: Gg3dEntity | null = null;

  constructor(
    protected readonly world: Gg3dPhysicsWorld,
    protected _colliderDescr: ColliderDesc,
    protected _bodyDescr: RigidBodyDesc,
    protected _colliderOptions: Omit<Omit<Body3DOptions, 'dynamic'>, 'mass'>,
  ) {
  }

  clone(): Gg3dBody {
    throw new Error('Not implemented');
    // return this.world.factory.createRigidBodyFromShape(
    //   this._nativeBody2.getCollisionShape(),
    //   {
    //     dynamic: !this._nativeBody2.isStaticObject(),
    //     mass: 5, // FIXME how to get mass??
    //     friction: this._nativeBody2.getFriction(),
    //     restitution: this._nativeBody2.getRestitution(),
    //   },
    //   {
    //     position: this.position,
    //     rotation: this.rotation,
    //   },
    // );
  }

  addToWorld(world: Gg3dPhysicsWorld): void {
    if (world != this.world) {
      throw new Error('Rapier3D bodies cannot be shared between different worlds');
    }
    this._nativeBody = this.world.nativeWorld!.createRigidBody(this._bodyDescr);
    this._nativeBodyCollider = this.world.nativeWorld!.createCollider(this._colliderDescr, this._nativeBody);
    this._nativeBodyCollider.setFriction(this._colliderOptions.friction);
    this._nativeBodyCollider.setRestitution(this._colliderOptions.restitution);
    this.world.handleIdEntityMap.set(this._nativeBody.handle, this);
  }

  removeFromWorld(world: Gg3dPhysicsWorld): void {
    if (world != this.world) {
      throw new Error('Rapier3D bodies cannot be shared between different worlds');
    }
    if (this._nativeBody) {
      this.world.nativeWorld!.removeCollider(this._nativeBodyCollider!, false);
      this.world.nativeWorld!.removeRigidBody(this._nativeBody);
      this.world.handleIdEntityMap.delete(this._nativeBody.handle);
      this._nativeBody = null;
      this._nativeBodyCollider = null;
    }
  }

  resetMotion(): void {
    this._nativeBody!.setAngvel(new Vector3(0, 0, 0), false);
    this._nativeBody!.setLinvel(new Vector3(0, 0, 0), false);
  }

  dispose(): void {
    if (this.nativeBody) {
      this.removeFromWorld(this.world);
    }
  }
}
