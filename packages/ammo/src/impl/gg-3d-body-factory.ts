import { IGg3dBodyFactory } from '@gg-web-engine/core';
import { Gg3dBody } from './gg-3d-body';
import { Gg3dPhysicsWorld } from './gg-3d-physics-world';
import Ammo from 'ammojs-typed';

export class Gg3dBodyFactory implements IGg3dBodyFactory {

  constructor(private readonly world: Gg3dPhysicsWorld) {
  }

  private createPrimitiveBody(shape: Ammo.btCollisionShape, mass: number): Gg3dBody {
    const ammo = this.world.ammo;
    const transform = new ammo.btTransform();
    transform.setOrigin(new ammo.btVector3(0, 0, 0));
    transform.setRotation(new ammo.btQuaternion(0, 0, 0, 1));
    const motionState = new ammo.btDefaultMotionState(transform);
    const localInertia = new ammo.btVector3(0, 0, 0);
    shape.calculateLocalInertia(mass, localInertia);
    const environmentBodyCI = new ammo.btRigidBodyConstructionInfo(mass, motionState, shape, localInertia);
    const body = new this.world.ammo.btRigidBody(environmentBodyCI);
    return new Gg3dBody(this.world, body);
  }

  createBox(width: number, length: number, height: number, mass: number): Gg3dBody {
    return this.createPrimitiveBody(
      new this.world.ammo.btBoxShape(new this.world.ammo.btVector3(width / 2, length / 2, height / 2)),
      mass
    );
  }

  createSphere(radius: number, mass: number): Gg3dBody {
    return this.createPrimitiveBody(new this.world.ammo.btSphereShape(radius), mass);
  }

}
