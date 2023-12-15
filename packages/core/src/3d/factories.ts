import { BodyShape3DDescriptor, Shape3DDescriptor } from './models/shapes';
import { Point3, Point4 } from '../base';
import { PhysicsTypeDocRepo3D, VisualTypeDocRepo3D } from './gg-3d-world';

export type DisplayObject3dOpts<Tex> = {
  color?: number;
  shading?: 'unlit' | 'standart' | 'phong';
  diffuse?: Tex;
  castShadow?: boolean;
  receiveShadow?: boolean;
};

export abstract class IDisplayObject3dComponentFactory<TypeDoc extends VisualTypeDocRepo3D = VisualTypeDocRepo3D> {
  abstract createPrimitive(
    descriptor: Shape3DDescriptor,
    material?: DisplayObject3dOpts<TypeDoc['texture']>,
  ): TypeDoc['displayObject'];

  abstract createPerspectiveCamera(settings: {
    fov?: number;
    aspectRatio?: number;
    frustrum?: { near: number; far: number };
  }): TypeDoc['camera'];

  randomColor(): number {
    return (
      (Math.floor(Math.random() * 256) << 16) | (Math.floor(Math.random() * 256) << 8) | Math.floor(Math.random() * 256)
    );
  }

  // shortcuts
  createPlane(material: DisplayObject3dOpts<TypeDoc['texture']> = {}): TypeDoc['displayObject'] {
    return this.createPrimitive({ shape: 'PLANE' }, material);
  }

  createBox(dimensions: Point3, material: DisplayObject3dOpts<TypeDoc['texture']> = {}): TypeDoc['displayObject'] {
    return this.createPrimitive({ shape: 'BOX', dimensions }, material);
  }

  createCapsule(
    radius: number,
    centersDistance: number,
    material: DisplayObject3dOpts<TypeDoc['texture']> = {},
  ): TypeDoc['displayObject'] {
    return this.createPrimitive({ shape: 'CAPSULE', radius, centersDistance }, material);
  }

  createCylinder(
    radius: number,
    height: number,
    material: DisplayObject3dOpts<TypeDoc['texture']> = {},
  ): TypeDoc['displayObject'] {
    return this.createPrimitive({ shape: 'CYLINDER', radius, height }, material);
  }

  createCone(
    radius: number,
    height: number,
    material: DisplayObject3dOpts<TypeDoc['texture']> = {},
  ): TypeDoc['displayObject'] {
    return this.createPrimitive({ shape: 'CONE', radius, height }, material);
  }

  createSphere(radius: number, material: DisplayObject3dOpts<TypeDoc['texture']> = {}): TypeDoc['displayObject'] {
    return this.createPrimitive({ shape: 'SPHERE', radius }, material);
  }
}

export interface IPhysicsBody3dComponentFactory<TypeDoc extends PhysicsTypeDocRepo3D = PhysicsTypeDocRepo3D> {
  createRigidBody(
    descriptor: BodyShape3DDescriptor,
    transform?: {
      position?: Point3;
      rotation?: Point4;
    },
  ): TypeDoc['rigidBody'];

  createTrigger(
    descriptor: Shape3DDescriptor,
    transform?: {
      position?: Point3;
      rotation?: Point4;
    },
  ): TypeDoc['trigger'];

  createRaycastVehicle(chassis: TypeDoc['rigidBody']): TypeDoc['raycastVehicle'];
}
