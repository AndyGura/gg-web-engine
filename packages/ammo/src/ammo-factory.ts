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
import Ammo from './ammo.js/ammo';
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
    return this.createRigidBodyFromShape(
      this.createShape(descriptor.shape),
      descriptor.shape,
      descriptor.body,
      transform,
    );
  }

  createTrigger(
    descriptor: Shape3DDescriptor,
    transform?: {
      position?: Point3;
      rotation?: Point4;
    },
  ): AmmoTriggerComponent {
    return this.createTriggerFromShape(this.createShape(descriptor), descriptor, transform);
  }

  createRaycastVehicle(chassis: AmmoRigidBodyComponent): AmmoRaycastVehicleComponent {
    return new AmmoRaycastVehicleComponent(this.world, chassis);
  }

  protected createShape(descriptor: Shape3DDescriptor): Ammo.btCollisionShape {
    let shape!: Ammo.btCollisionShape;
    switch (descriptor.shape) {
      case 'PLANE':
        shape = new Ammo.btStaticPlaneShape(new Ammo.btVector3(0, 0, 1), 0);
        break;
      case 'BOX':
        shape = new Ammo.btBoxShape(
          new Ammo.btVector3(descriptor.dimensions.x / 2, descriptor.dimensions.y / 2, descriptor.dimensions.z / 2),
        );
        break;
      case 'CAPSULE':
        shape = new Ammo.btCapsuleShapeZ(descriptor.radius, descriptor.centersDistance);
        break;
      case 'CYLINDER':
        shape = new Ammo.btCylinderShapeZ(
          new Ammo.btVector3(descriptor.radius, descriptor.radius, descriptor.height / 2),
        );
        break;
      case 'CONE':
        shape = new Ammo.btConeShapeZ(descriptor.radius, descriptor.height);
        break;
      case 'SPHERE':
        shape = new Ammo.btSphereShape(descriptor.radius);
        break;
      case 'COMPOUND':
        let cs: Ammo.btCompoundShape = new Ammo.btCompoundShape();
        for (const item of descriptor.children) {
          const subShape = this.createShape(item.shape);
          if (!subShape) {
            continue;
          }
          const subShapeTransform = new Ammo.btTransform();
          const pos = item.position || Pnt3.O;
          const rot = item.rotation || Qtrn.O;
          subShapeTransform.setOrigin(new Ammo.btVector3(pos.x, pos.y, pos.z));
          subShapeTransform.setRotation(new Ammo.btQuaternion(rot.x, rot.y, rot.z, rot.w));
          cs.addChildShape(subShapeTransform, subShape);
        }
        shape = cs;
        break;
      case 'CONVEX_HULL':
        const s = new Ammo.btConvexHullShape();
        const tmpVector = new Ammo.btVector3();
        for (const v of descriptor.vertices) {
          tmpVector.setValue(v.x, v.y, v.z);
          s.addPoint(tmpVector);
        }
        Ammo.destroy(tmpVector);
        s.recalcLocalAabb();
        shape = s;
        break;
      case 'MESH':
        const mesh = new Ammo.btTriangleMesh(true, true);
        const tmpVectors: [Ammo.btVector3, Ammo.btVector3, Ammo.btVector3] = [
          new Ammo.btVector3(),
          new Ammo.btVector3(),
          new Ammo.btVector3(),
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
          Ammo.destroy(v);
        });
        shape = new Ammo.btBvhTriangleMeshShape(mesh, false, true);
        break;
      default:
        throw new Error(`Shape "${(descriptor as any).shape}" not implemented for Ammo.js`);
    }
    if (descriptor.collisionMargin) {
      shape.setMargin(descriptor.collisionMargin);
    }
    return shape;
  }

  public createRigidBodyFromShape(
    nativeShape: Ammo.btCollisionShape,
    shapeDescr: Shape3DDescriptor,
    options: Partial<Body3DOptions>,
    transform?: { position?: Point3; rotation?: Point4 },
  ): AmmoRigidBodyComponent {
    if (options.dynamic === false) {
      options.mass = 0;
    }
    const pos = transform?.position || Pnt3.O;
    const rot = transform?.rotation || Qtrn.O;
    const ammoTransform = new Ammo.btTransform();
    ammoTransform.setOrigin(new Ammo.btVector3(pos.x, pos.y, pos.z));
    ammoTransform.setRotation(new Ammo.btQuaternion(rot.x, rot.y, rot.z, rot.w));
    const motionState = new Ammo.btDefaultMotionState(ammoTransform);
    const localInertia = new Ammo.btVector3(0, 0, 0);
    nativeShape.calculateLocalInertia(options.mass || 0, localInertia);
    const environmentBodyCI = new Ammo.btRigidBodyConstructionInfo(
      options.mass || 0,
      motionState,
      nativeShape,
      localInertia,
    );
    if (options.friction) {
      environmentBodyCI.set_m_friction(options.friction);
      environmentBodyCI.set_m_rollingFriction(options.friction);
    }
    if (options.restitution) {
      environmentBodyCI.set_m_restitution(options.restitution);
    }
    const comp = new AmmoRigidBodyComponent(this.world, new Ammo.btRigidBody(environmentBodyCI), shapeDescr);
    if (options.ownCollisionGroups && options.ownCollisionGroups !== 'all') {
      comp.ownCollisionGroups = options.ownCollisionGroups;
    }
    if (options.interactWithCollisionGroups && options.interactWithCollisionGroups !== 'all') {
      comp.interactWithCollisionGroups = options.interactWithCollisionGroups;
    }
    return comp;
  }

  public createTriggerFromShape(
    nativeShape: Ammo.btCollisionShape,
    shapeDescr: Shape3DDescriptor,
    transform?: { position?: Point3; rotation?: Point4 },
  ): AmmoTriggerComponent {
    const ghostObject = new Ammo.btPairCachingGhostObject();
    ghostObject.setCollisionShape(nativeShape);
    ghostObject.setCollisionFlags(ghostObject.getCollisionFlags() | 4); // 4 is a CF_NO_CONTACT_RESPONSE collision flag
    ghostObject
      .getWorldTransform()
      .setOrigin(
        new Ammo.btVector3(transform?.position?.x || 0, transform?.position?.y || 0, transform?.position?.z || 0),
      );
    ghostObject
      .getWorldTransform()
      .setRotation(
        new Ammo.btQuaternion(
          transform?.rotation?.x || 0,
          transform?.rotation?.y || 0,
          transform?.rotation?.z || 0,
          transform?.rotation?.w || 1,
        ),
      );
    return new AmmoTriggerComponent(this.world, ghostObject, shapeDescr);
  }
}
