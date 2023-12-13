import { AmmoWorldComponent } from './ammo-world.component';
import Ammo from 'ammojs-typed';
import { AmmoBodyComponent } from './ammo-body.component';
import { Entity3d, Gg3dWorld, IRigidBody3dComponent, Point3, VisualTypeDocRepo3D } from '@gg-web-engine/core';
import { AmmoPhysicsTypeDocRepo } from '../types';

export class AmmoRigidBodyComponent
  extends AmmoBodyComponent<Ammo.btRigidBody>
  implements IRigidBody3dComponent<AmmoPhysicsTypeDocRepo>
{
  public entity: Entity3d | null = null;

  get linearVelocity(): Point3 {
    const v = this.nativeBody.getLinearVelocity();
    return { x: v.x(), y: v.y(), z: v.z() };
  }

  set linearVelocity(value: Point3) {
    this.nativeBody.setLinearVelocity(new this.ammo.btVector3(value.x, value.y, value.z));
  }

  get angularVelocity(): Point3 {
    const v = this.nativeBody.getAngularVelocity();
    return { x: v.x(), y: v.y(), z: v.z() };
  }

  set angularVelocity(value: Point3) {
    this.nativeBody.setAngularVelocity(new this.ammo.btVector3(value.x, value.y, value.z));
  }

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

  addToWorld(world: Gg3dWorld<VisualTypeDocRepo3D, AmmoPhysicsTypeDocRepo>): void {
    if (world.physicsWorld != this.world) {
      throw new Error('Ammo bodies cannot be shared between different worlds');
    }
    this.world.dynamicAmmoWorld?.addRigidBody(this.nativeBody);
  }

  removeFromWorld(world: Gg3dWorld<VisualTypeDocRepo3D, AmmoPhysicsTypeDocRepo>): void {
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
