import {
  Body3DOptions,
  BodyShape3DDescriptor,
  IPhysicsBody3dComponentFactory,
  Pnt3,
  Point3,
  Point4,
  Qtrn,
  Shape3DDescriptor,
} from '@gg-web-engine/core';
import Ammo from 'ammojs-typed';
import { AmmoRigidBodyComponent } from './components/ammo-rigid-body.component';
import { AmmoTriggerComponent } from './components/ammo-trigger.component';
import { AmmoWorldComponent } from './components/ammo-world.component';
import { AmmoPhysicsTypeDocRepo } from './types';
import { AmmoRaycastVehicleComponent } from './components/ammo-raycast-vehicle.component';

export class AmmoFactory implements IPhysicsBody3dComponentFactory<AmmoPhysicsTypeDocRepo> {
  constructor(protected readonly world: AmmoWorldComponent) {}

  createRigidBody(
    descriptor: BodyShape3DDescriptor,
    transform?: {
      position?: Point3;
      rotation?: Point4;
    },
  ): AmmoRigidBodyComponent {
    return this.createRigidBodyFromShape(this.createShape(descriptor.shape), descriptor.body, transform);
  }

  createTrigger(
    descriptor: Shape3DDescriptor,
    transform?: {
      position?: Point3;
      rotation?: Point4;
    },
  ): AmmoTriggerComponent {
    return this.createTriggerFromShape(this.createShape(descriptor), transform);
  }

  createRaycastVehicle(chassis: AmmoRigidBodyComponent): AmmoRaycastVehicleComponent {
    return new AmmoRaycastVehicleComponent(this.world, chassis);
  }

  protected createShape(descriptor: Shape3DDescriptor): Ammo.btCollisionShape {
    switch (descriptor.shape) {
      case 'BOX':
        return new this.world.ammo.btBoxShape(
          new this.world.ammo.btVector3(
            descriptor.dimensions.x / 2,
            descriptor.dimensions.y / 2,
            descriptor.dimensions.z / 2,
          ),
        );
      case 'CAPSULE':
        return new this.world.ammo.btCapsuleShapeZ(descriptor.radius, descriptor.centersDistance);
      case 'CYLINDER':
        return new this.world.ammo.btCylinderShapeZ(
          new this.world.ammo.btVector3(descriptor.radius, descriptor.radius, descriptor.height / 2),
        );
      case 'CONE':
        return new this.world.ammo.btConeShapeZ(descriptor.radius, descriptor.height);
      case 'SPHERE':
        return new this.world.ammo.btSphereShape(descriptor.radius);
      case 'COMPOUND':
        const compoundShape: Ammo.btCollisionShape = new this.world.ammo.btCompoundShape();
        for (const item of descriptor.children) {
          const subShape = this.createShape(item.shape);
          if (!subShape) {
            continue;
          }
          const subShapeTransform = new this.world.ammo.btTransform();
          const pos = item.position || Pnt3.O;
          const rot = item.rotation || Qtrn.O;
          subShapeTransform.setOrigin(new this.world.ammo.btVector3(pos.x, pos.y, pos.z));
          subShapeTransform.setRotation(new this.world.ammo.btQuaternion(rot.x, rot.y, rot.z, rot.w));
          (compoundShape as Ammo.btCompoundShape).addChildShape(subShapeTransform, subShape);
        }
        return compoundShape;
      case 'CONVEX_HULL':
        const shape = new this.world.ammo.btConvexHullShape();
        const tmpVector = new this.world.ammo.btVector3();
        for (const v of descriptor.vertices) {
          tmpVector.setValue(v.x, v.y, v.z);
          shape.addPoint(tmpVector);
        }
        this.world.ammo.destroy(tmpVector);
        shape.recalcLocalAabb();
        return shape;
      case 'MESH':
        const mesh = new this.world.ammo.btTriangleMesh(true, true);
        const tmpVectors: [Ammo.btVector3, Ammo.btVector3, Ammo.btVector3] = [
          new this.world.ammo.btVector3(),
          new this.world.ammo.btVector3(),
          new this.world.ammo.btVector3(),
        ];
        for (const f of descriptor.faces) {
          for (let j = 0; j < 3; j++) {
            tmpVectors[j].setValue(
              descriptor.vertices[f[0]].x,
              descriptor.vertices[f[1]].y,
              descriptor.vertices[f[2]].z,
            );
          }
          mesh.addTriangle(...tmpVectors, true);
        }
        tmpVectors.forEach(v => {
          this.world.ammo.destroy(v);
        });
        return new this.world.ammo.btBvhTriangleMeshShape(mesh, false, true);
    }
    throw new Error(`Shape "${(descriptor as any).shape}" not implemented for Ammo.js`);
  }

  public createRigidBodyFromShape(
    shape: Ammo.btCollisionShape,
    options: Partial<Body3DOptions>,
    transform?: { position?: Point3; rotation?: Point4 },
  ): AmmoRigidBodyComponent {
    if (options.dynamic === false) {
      options.mass = 0;
    }
    const pos = transform?.position || Pnt3.O;
    const rot = transform?.rotation || Qtrn.O;
    const ammo = this.world.ammo;
    const ammoTransform = new ammo.btTransform();
    ammoTransform.setOrigin(new ammo.btVector3(pos.x, pos.y, pos.z));
    ammoTransform.setRotation(new ammo.btQuaternion(rot.x, rot.y, rot.z, rot.w));
    const motionState = new ammo.btDefaultMotionState(ammoTransform);
    const localInertia = new ammo.btVector3(0, 0, 0);
    shape.calculateLocalInertia(options.mass || 0, localInertia);
    const environmentBodyCI = new ammo.btRigidBodyConstructionInfo(options.mass || 0, motionState, shape, localInertia);
    if (options.friction) {
      environmentBodyCI.set_m_friction(options.friction);
      environmentBodyCI.set_m_rollingFriction(options.friction);
    }
    if (options.restitution) {
      environmentBodyCI.set_m_restitution(options.restitution);
    }
    const comp = new AmmoRigidBodyComponent(this.world, new this.world.ammo.btRigidBody(environmentBodyCI));
    if (options.ownCollisionGroups && options.ownCollisionGroups !== 'all') {
      comp.ownCollisionGroups = options.ownCollisionGroups;
    }
    if (options.interactWithCollisionGroups && options.interactWithCollisionGroups !== 'all') {
      comp.interactWithCollisionGroups = options.interactWithCollisionGroups;
    }
    return comp;
  }

  public createTriggerFromShape(
    shape: Ammo.btCollisionShape,
    transform?: { position?: Point3; rotation?: Point4 },
  ): AmmoTriggerComponent {
    const ghostObject = new this.world.ammo.btPairCachingGhostObject();
    ghostObject.setCollisionShape(shape);
    ghostObject.setCollisionFlags(ghostObject.getCollisionFlags() | 4); // 4 is a CF_NO_CONTACT_RESPONSE collision flag
    ghostObject
      .getWorldTransform()
      .setOrigin(
        new this.world.ammo.btVector3(
          transform?.position?.x || 0,
          transform?.position?.y || 0,
          transform?.position?.z || 0,
        ),
      );
    ghostObject
      .getWorldTransform()
      .setRotation(
        new this.world.ammo.btQuaternion(
          transform?.rotation?.x || 0,
          transform?.rotation?.y || 0,
          transform?.rotation?.z || 0,
          transform?.rotation?.w || 1,
        ),
      );
    return new AmmoTriggerComponent(this.world, ghostObject);
  }
}
