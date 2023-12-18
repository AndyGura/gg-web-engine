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
    this.nativeBody.setLinearVelocity(new Ammo.btVector3(value.x, value.y, value.z));
  }

  get angularVelocity(): Point3 {
    const v = this.nativeBody.getAngularVelocity();
    return { x: v.x(), y: v.y(), z: v.z() };
  }

  set angularVelocity(value: Point3) {
    this.nativeBody.setAngularVelocity(new Ammo.btVector3(value.x, value.y, value.z));
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
    super.addToWorld(world);
    this.world.dynamicAmmoWorld?.addRigidBody(this.nativeBody, this._ownCGsMask, this._interactWithCGsMask);
  }

  removeFromWorld(world: Gg3dWorld<VisualTypeDocRepo3D, AmmoPhysicsTypeDocRepo>): void {
    super.removeFromWorld(world);
    this.world.dynamicAmmoWorld?.removeRigidBody(this.nativeBody);
  }

  refreshCG(): void {
    this.world.dynamicAmmoWorld?.removeRigidBody(this.nativeBody);
    this.world.dynamicAmmoWorld?.addRigidBody(this.nativeBody, this._ownCGsMask, this._interactWithCGsMask);
  }

  resetMotion(): void {
    const emptyVector = new Ammo.btVector3();
    this.nativeBody.setLinearVelocity(emptyVector);
    this.nativeBody.setAngularVelocity(emptyVector);
    this.nativeBody.clearForces();
    this.nativeBody.updateInertiaTensor();
    Ammo.destroy(emptyVector);
  }
}
