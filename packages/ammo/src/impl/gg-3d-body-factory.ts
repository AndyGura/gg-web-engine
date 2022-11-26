import { Body3DOptions, BodyPrimitiveDescriptor, IGg3dBodyFactory, Point3 } from '@gg-web-engine/core';
import { Gg3dBody } from './gg-3d-body';
import { Gg3dPhysicsWorld } from './gg-3d-physics-world';
import Ammo from 'ammojs-typed';

export class Gg3dBodyFactory extends IGg3dBodyFactory<Gg3dBody> {

  constructor(private readonly world: Gg3dPhysicsWorld) {
    super();
  }

  createBox(dimensions: Point3, options: Partial<Body3DOptions>): Gg3dBody {
    return this.createBody(
      new this.world.ammo.btBoxShape(new this.world.ammo.btVector3(dimensions.x / 2, dimensions.y / 2, dimensions.z / 2)),
      options
    );
  }

  createCapsule(radius: number, centersDistance: number, options: Partial<Body3DOptions>): Gg3dBody {
    return this.createBody(
      new this.world.ammo.btCapsuleShapeZ(radius, centersDistance + radius * 2),
      options
    );
  }

  createCylinder(radius: number, height: number, options: Partial<Body3DOptions>): Gg3dBody {
    return this.createBody(
      new this.world.ammo.btCylinderShapeZ(new this.world.ammo.btVector3(radius, radius, height / 2)),
      options
    );
  }

  createCone(radius: number, height: number, options: Partial<Body3DOptions>): Gg3dBody {
    return this.createBody(
      new this.world.ammo.btConeShapeZ(radius, height),
      options
    );
  }

  createSphere(radius: number, options: Partial<Body3DOptions>): Gg3dBody {
    return this.createBody(new this.world.ammo.btSphereShape(radius), options);
  }

  createCompoundBody(items: BodyPrimitiveDescriptor[]): Gg3dBody {
    let shapeMass = 0;
    let shapeTotalFriction = 0;
    let shapeTotalRestitution = 0;
    const isDynamic = items[0].dynamic;
    const shape: Ammo.btCollisionShape = new this.world.ammo.btCompoundShape();
    for (const item of items) {
      if (isDynamic != item.dynamic) {
        throw new Error('Rigid body dynamic flag differs in children of one single scene!');
      }
      const subShape = this.createPrimitive(item);
      if (!subShape) {
        continue;
      }
      const subShapeTransform = new this.world.ammo.btTransform();
      const pos = item.position || { x: 0, y: 0, z: 0 };
      const rot = item.rotation || { x: 0, y: 0, z: 0, w: 0 };
      subShapeTransform.setOrigin(new this.world.ammo.btVector3(pos.x, pos.y, pos.z));
      subShapeTransform.setRotation(new this.world.ammo.btQuaternion(rot.x, rot.y, rot.z, rot.w));
      (shape as Ammo.btCompoundShape).addChildShape(subShapeTransform, subShape.nativeBody.getCollisionShape());
      shapeMass += item.mass || 0;
      shapeTotalFriction += item.friction || 0;
      shapeTotalRestitution += item.restitution || 0;
    }
    const motionState = new this.world.ammo.btDefaultMotionState(new this.world.ammo.btTransform());
    const localInertia = new this.world.ammo.btVector3(0, 0, 0);
    const mass = isDynamic ? shapeMass : 0;
    shape.calculateLocalInertia(mass, localInertia);
    const environmentBodyCI = new this.world.ammo.btRigidBodyConstructionInfo(mass, motionState, shape, localInertia);
    environmentBodyCI.set_m_friction(shapeTotalFriction / items.length);
    environmentBodyCI.set_m_rollingFriction(shapeTotalFriction / items.length);
    environmentBodyCI.set_m_restitution(shapeTotalRestitution / items.length);
    return new Gg3dBody(this.world, new this.world.ammo.btRigidBody(environmentBodyCI));
  }

  createConvexHull(vertices: Point3[], options: Partial<Body3DOptions>): Gg3dBody {
    const shape = new this.world.ammo.btConvexHullShape();
    const tmpVector = new this.world.ammo.btVector3();
    for (const v of vertices) {
      tmpVector.setValue(v.x, v.y, v.z);
      shape.addPoint(tmpVector);
    }
    this.world.ammo.destroy(tmpVector);
    shape.recalcLocalAabb();
    return this.createBody(shape, options);
  }

  createMesh(vertices: Point3[], faces: [number, number, number][], options: Partial<Body3DOptions>): Gg3dBody {
    const mesh = new this.world.ammo.btTriangleMesh(true, true);
    const tmpVectors: [Ammo.btVector3, Ammo.btVector3, Ammo.btVector3] = [
      new this.world.ammo.btVector3(),
      new this.world.ammo.btVector3(),
      new this.world.ammo.btVector3()
    ];
    for (const f of faces) {
      for (let j = 0; j < 3; j++) {
        tmpVectors[j].setValue(vertices[f[0]].x, vertices[f[1]].y, vertices[f[2]].z);
      }
      mesh.addTriangle(...tmpVectors, true);
    }
    tmpVectors.forEach((v) => {
      this.world.ammo.destroy(v);
    })
    return this.createBody(new this.world.ammo.btBvhTriangleMeshShape(mesh, false, true), options);
  }

  private createBody(shape: Ammo.btCollisionShape, options: Partial<Body3DOptions>): Gg3dBody {
    const ammo = this.world.ammo;
    const transform = new ammo.btTransform();
    transform.setOrigin(new ammo.btVector3(0, 0, 0));
    transform.setRotation(new ammo.btQuaternion(0, 0, 0, 1));
    const motionState = new ammo.btDefaultMotionState(transform);
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
    const body = new this.world.ammo.btRigidBody(environmentBodyCI);
    return new Gg3dBody(this.world, body);
  }

}
