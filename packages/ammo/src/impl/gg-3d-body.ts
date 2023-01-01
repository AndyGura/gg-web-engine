import { IGg3dBody, Point3, Point4 } from '@gg-web-engine/core';
import { Gg3dPhysicsWorld } from './gg-3d-physics-world';
import Ammo from 'ammojs-typed';

export class Gg3dBody implements IGg3dBody {

  private _tmpTrans: Ammo.btTransform | undefined;
  private get tmpTrans(): Ammo.btTransform {
    if (!this._tmpTrans) {
      this._tmpTrans = new this.ammo.btTransform() as Ammo.btTransform;
    }
    return this._tmpTrans;
  }

  protected get ammo(): typeof Ammo {
    return this.world.ammo as any;
  }

  public get position(): Point3 {
    this.nativeBody.getMotionState().getWorldTransform(this.tmpTrans);
    const origin = this.tmpTrans.getOrigin();
    return { x: origin.x(), y: origin.y(), z: origin.z() };
  }

  public set position(value: Point3) {
    const transform = new this.ammo.btTransform();
    transform.setOrigin(new this.ammo.btVector3(value.x, value.y, value.z));
    this.nativeBody.setMotionState(new this.ammo.btDefaultMotionState(transform));
    this.ammo.destroy(transform);
  }

  public get rotation(): Point4 {
    this.nativeBody.getMotionState().getWorldTransform(this.tmpTrans);
    const quaternion = this.tmpTrans.getRotation();
    return { x: quaternion.x(), y: quaternion.y(), z: quaternion.z(), w: quaternion.w() };
  }

  public set rotation(value: Point4) {
    const transform = new this.ammo.btTransform();
    transform.setRotation(new this.ammo.btQuaternion(value.x, value.y, value.z, value.w));
    this.nativeBody.setMotionState(new this.ammo.btDefaultMotionState(transform));
    this.ammo.destroy(transform);
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
    this.ammo.destroy(this.nativeBody);
    this.ammo.destroy(this._tmpTrans);
  }

}
