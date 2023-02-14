import { IGg3dBody, Point3, Point4 } from '@gg-web-engine/core';
import { Gg3dPhysicsWorld } from './gg-3d-physics-world';
import Ammo from 'ammojs-typed';

export class Gg3dBody implements IGg3dBody {

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

  constructor(
    private readonly world: Gg3dPhysicsWorld,
    public nativeBody: Ammo.btRigidBody,
  ) {
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

  dispose(): void {
    try {
      this.ammo.destroy(this.nativeBody);
    } catch {
      // pass
    }
  }

}
