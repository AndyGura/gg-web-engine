import { BodyShape3DDescriptor, Shape3DDescriptor } from './models/shapes';
import { Point3, Point4 } from '../base/models/points';
import { IGg3dBody, IGg3dObject, IGg3dTrigger } from './interfaces';

export abstract class IGg3dObjectFactory<T extends IGg3dObject = IGg3dObject> {
  abstract createPrimitive(descriptor: Shape3DDescriptor, material?: any): T;

  // shortcuts
  createBox(dimensions: Point3, material?: any): T {
    return this.createPrimitive({ shape: 'BOX', dimensions }, material);
  }
  createCapsule(radius: number, centersDistance: number, material?: any): T {
    return this.createPrimitive({ shape: 'CAPSULE', radius, centersDistance }, material);
  }
  createCylinder(radius: number, height: number, material?: any): T {
    return this.createPrimitive({ shape: 'CYLINDER', radius, height }, material);
  }
  createCone(radius: number, height: number, material?: any): T {
    return this.createPrimitive({ shape: 'CONE', radius, height }, material);
  }
  createSphere(radius: number): T {
    return this.createPrimitive({ shape: 'SPHERE', radius });
  }
}

export interface IGg3dBodyFactory<T extends IGg3dBody = IGg3dBody, K extends IGg3dTrigger = IGg3dTrigger> {
  createRigidBody(descriptor: BodyShape3DDescriptor, transform?: { position?: Point3; rotation?: Point4 }): T;
  createTrigger(descriptor: Shape3DDescriptor, transform?: { position?: Point3; rotation?: Point4 }): K;
}
