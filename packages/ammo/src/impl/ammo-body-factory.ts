import { Gg3dBodyFactory } from '@gg-web-engine/core';
import { AmmoBody } from './ammo-body';
import { AmmoWorld } from './ammo-world';
import Ammo from 'ammojs-typed';

export class AmmoBodyFactory implements Gg3dBodyFactory {

  constructor(private readonly world: AmmoWorld) {
  }

  private createPrimitiveBody(shape: Ammo.btCollisionShape, mass: number): AmmoBody {
    const ammo = this.world.ammo;
    const transform = new ammo.btTransform();
    transform.setOrigin(new ammo.btVector3(0, 0, 0));
    transform.setRotation(new ammo.btQuaternion(0, 0, 0, 1));
    const motionState = new ammo.btDefaultMotionState(transform);
    const localInertia = new ammo.btVector3(0, 0, 0);
    shape.calculateLocalInertia(mass, localInertia);
    const environmentBodyCI = new ammo.btRigidBodyConstructionInfo(mass, motionState, shape, localInertia);
    const body = new this.world.ammo.btRigidBody(environmentBodyCI);
    return new AmmoBody(this.world, body);
  }

  createBox(width: number, length: number, height: number, mass: number): AmmoBody {
    return this.createPrimitiveBody(
      new this.world.ammo.btBoxShape(new this.world.ammo.btVector3(width / 2, length / 2, height / 2)),
      mass
    );
  }

  createSphere(radius: number, mass: number): AmmoBody {
    return this.createPrimitiveBody(new this.world.ammo.btSphereShape(radius), mass);
  }

}
