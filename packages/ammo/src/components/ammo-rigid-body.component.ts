import { AmmoWorldComponent } from './ammo-world.component';
import Ammo from 'ammojs-typed';
import { AmmoBodyComponent } from './ammo-body.component';
import { Entity3d, Gg3dWorld, IVisualScene3dComponent } from '@gg-web-engine/core';

export class AmmoRigidBodyComponent extends AmmoBodyComponent<Ammo.btRigidBody> {
  public entity: Entity3d | null = null;

  constructor(protected readonly world: AmmoWorldComponent, protected _nativeBody: Ammo.btRigidBody) {
    super(world, _nativeBody);
  }

  clone(): AmmoRigidBodyComponent {
    return this.world.factory.createRigidBodyFromShape(
      this._nativeBody.getCollisionShape(),
      {
        dynamic: !this._nativeBody.isStaticObject(),
        mass: 5, // FIXME how to get mass??
        friction: this._nativeBody.getFriction(),
        restitution: this._nativeBody.getRestitution(),
      },
      {
        position: this.position,
        rotation: this.rotation,
      },
    );
  }

  addToWorld(world: Gg3dWorld<IVisualScene3dComponent, AmmoWorldComponent>): void {
    if (world.physicsWorld != this.world) {
      throw new Error('Ammo bodies cannot be shared between different worlds');
    }
    this.world.dynamicAmmoWorld?.addRigidBody(this.nativeBody);
  }

  removeFromWorld(world: Gg3dWorld<IVisualScene3dComponent, AmmoWorldComponent>): void {
    if (world.physicsWorld != this.world) {
      throw new Error('Ammo bodies cannot be shared between different worlds');
    }
    this.world.dynamicAmmoWorld?.removeRigidBody(this.nativeBody);
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
