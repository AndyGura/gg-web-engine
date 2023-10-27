import { BodyShape3DDescriptor, Shape3DDescriptor } from './models/shapes';
import { Point3, Point4 } from '../base';
import { IDisplayObject3dComponent } from './components/rendering/i-display-object-3d.component';
import { ITrigger3dComponent } from './components/physics/i-trigger-3d.component';
import { IRigidBody3dComponent } from './components/physics/i-rigid-body-3d.component';

export abstract class IDisplayObject3dComponentFactory<
  DOC extends IDisplayObject3dComponent = IDisplayObject3dComponent,
> {
  abstract createPrimitive(descriptor: Shape3DDescriptor, material?: any): DOC;

  // shortcuts
  createBox(dimensions: Point3, material?: any): DOC {
    return this.createPrimitive({ shape: 'BOX', dimensions }, material);
  }

  createCapsule(radius: number, centersDistance: number, material?: any): DOC {
    return this.createPrimitive({ shape: 'CAPSULE', radius, centersDistance }, material);
  }

  createCylinder(radius: number, height: number, material?: any): DOC {
    return this.createPrimitive({ shape: 'CYLINDER', radius, height }, material);
  }

  createCone(radius: number, height: number, material?: any): DOC {
    return this.createPrimitive({ shape: 'CONE', radius, height }, material);
  }

  createSphere(radius: number): DOC {
    return this.createPrimitive({ shape: 'SPHERE', radius });
  }
}

export interface IPhysicsBody3dComponentFactory<
  T extends IRigidBody3dComponent = IRigidBody3dComponent,
  K extends ITrigger3dComponent = ITrigger3dComponent,
> {
  createRigidBody(descriptor: BodyShape3DDescriptor, transform?: { position?: Point3; rotation?: Point4 }): T;

  createTrigger(descriptor: Shape3DDescriptor, transform?: { position?: Point3; rotation?: Point4 }): K;
}
