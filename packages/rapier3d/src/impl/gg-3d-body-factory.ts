import {
  Body3DOptions,
  BodyShape3DDescriptor,
  IGg3dBodyFactory,
  Pnt3,
  Point3,
  Point4,
  Qtrn,
  Shape3DDescriptor,
} from '@gg-web-engine/core';
import { Gg3dBody } from './bodies/gg-3d-body';
import { Gg3dPhysicsWorld } from './gg-3d-physics-world';
import { Gg3dTrigger } from './bodies/gg-3d-trigger';
import { ActiveEvents, ColliderDesc, Quaternion, RigidBodyDesc } from '@dimforge/rapier3d';


export class Gg3dBodyFactory implements IGg3dBodyFactory<Gg3dBody, Gg3dTrigger> {
  constructor(protected readonly world: Gg3dPhysicsWorld) {
  }

  createRigidBody(
    descriptor: BodyShape3DDescriptor,
    transform?: {
      position?: Point3;
      rotation?: Point4;
    },
  ): Gg3dBody {
    return new Gg3dBody(
      this.world,
      this.createColliderDescr(descriptor.shape),
      this.createRigidBodyDescr(descriptor.body, transform),
      {
        friction: 0.5,
        restitution: 0.1,
        ...descriptor.body
      },
    );
  }

  createTrigger(
    descriptor: Shape3DDescriptor,
    transform?: {
      position?: Point3;
      rotation?: Point4;
    },
  ): Gg3dTrigger {
    const colliderDescr = this.createColliderDescr(descriptor);
    colliderDescr.isSensor = true;
    colliderDescr.setActiveEvents(ActiveEvents.COLLISION_EVENTS);
    return new Gg3dTrigger(this.world, colliderDescr, this.createRigidBodyDescr({ dynamic: false }, transform));
  }

  protected createColliderDescr(descriptor: Shape3DDescriptor): ColliderDesc {
    const yToZUp = Qtrn.rotAround(Qtrn.O, Pnt3.X, Math.PI / 2);
    switch (descriptor.shape) {
      case 'BOX':
        return ColliderDesc.cuboid(descriptor.dimensions.x / 2, descriptor.dimensions.y / 2, descriptor.dimensions.z / 2);
      case 'CAPSULE':
        const capsule = ColliderDesc.capsule(descriptor.centersDistance / 2, descriptor.radius);
        capsule.setRotation(new Quaternion(yToZUp.x, yToZUp.y, yToZUp.z, yToZUp.w));
        return capsule;
      case 'CYLINDER':
        const cylinder = ColliderDesc.cylinder(descriptor.height / 2, descriptor.radius);
        cylinder.setRotation(new Quaternion(yToZUp.x, yToZUp.y, yToZUp.z, yToZUp.w));
        return cylinder;
      case 'CONE':
        const cone = ColliderDesc.cone(descriptor.height / 2, descriptor.radius);
        cone.setRotation(new Quaternion(yToZUp.x, yToZUp.y, yToZUp.z, yToZUp.w));
        return cone;
      case 'SPHERE':
        return ColliderDesc.ball(descriptor.radius);
      case 'COMPOUND':
        throw new Error('Not implemented');
      case 'MESH':
        throw new Error('Not implemented');
    }
    throw new Error(`Shape "${(descriptor as any).shape}" not implemented for Rapier 3D`);
  }

  public createRigidBodyDescr(
    options: Partial<Body3DOptions>,
    transform?: { position?: Point3; rotation?: Point4 },
  ): RigidBodyDesc {
    const pos = transform?.position || Pnt3.O;
    const rot = transform?.rotation || Qtrn.O;
    const fixed = options.dynamic === false || !options.mass;
    let bodyDesc!: RigidBodyDesc;
    if (fixed) {
      bodyDesc = RigidBodyDesc.fixed();
    } else {
      bodyDesc = RigidBodyDesc.dynamic();
      bodyDesc.mass = options.mass || 1;
    }
    return bodyDesc
      .setTranslation(pos.x, pos.y, pos.z)
      .setRotation(new Quaternion(rot.x, rot.y, rot.z, rot.w));
  }
}
