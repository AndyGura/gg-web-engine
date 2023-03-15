import { Gg3dPhysicsWorld } from '../gg-3d-physics-world';
import Ammo from 'ammojs-typed';
import { BaseAmmoGGBody } from './base-ammo-gg-body';
import { Gg3dEntity } from '@gg-web-engine/core';

export class Gg3dBody extends BaseAmmoGGBody<Ammo.btRigidBody> {

  public entity: Gg3dEntity | null = null;

  constructor(
    protected readonly world: Gg3dPhysicsWorld,
    protected _nativeBody: Ammo.btRigidBody,
  ) {
    super(world, _nativeBody);
  }

  clone(): Gg3dBody {
    return this.world.factory.createRigidBodyFromShape(
      this._nativeBody.getCollisionShape(), {
        dynamic: !this._nativeBody.isStaticObject(),
        mass: 5, // FIXME how to get mass??
        friction: this._nativeBody.getFriction(),
        restitution: this._nativeBody.getRestitution(),
      }, {
        position: this.position,
        rotation: this.rotation,
      }
    );
  }

  addToWorld(world: Gg3dPhysicsWorld): void {
    if (world != this.world) {
      throw new Error('Ammo bodies cannot be shared between different worlds');
    }
    world.dynamicAmmoWorld?.addRigidBody(this.nativeBody);
  }

  removeFromWorld(world: Gg3dPhysicsWorld): void {
    world.dynamicAmmoWorld?.removeRigidBody(this.nativeBody);
  }

  resetMotion(): void {
    const emptyVector = new this.ammo.btVector3();
    this.nativeBody.setLinearVelocity(emptyVector);
    this.nativeBody.setAngularVelocity(emptyVector);
    this.nativeBody.clearForces();
    this.nativeBody.updateInertiaTensor();
    this.ammo.destroy(emptyVector);
  }

}
