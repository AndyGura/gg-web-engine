import { GgBody } from '../base/interfaces/gg-body';
import { Point3, Point4 } from '../base/models/points';
import { GgObject } from '../base/interfaces/gg-object';
import { GgPhysicsWorld } from '../base/interfaces/gg-physics-world';
import { GgVisualScene } from '../base/interfaces/gg-visual-scene';
import { BodyPrimitiveDescriptor, GgMeta } from './models/gg-meta';
import { Body3DOptions } from './models/body-options';

// These interfaces have to be implemented for a particular 3D physics engine
export interface IGg3dPhysicsWorld extends GgPhysicsWorld<Point3, Point4> {
  readonly factory: IGg3dBodyFactory;
  readonly loader: IGg3dBodyLoader;
}

export interface IGg3dBody extends GgBody<Point3, Point4> {
}

export abstract class IGg3dBodyFactory<T extends IGg3dBody = IGg3dBody> {
  abstract createBox(dimensions: Point3, options: Partial<Body3DOptions>): T;
  abstract createCapsule(radius: number, centersDistance: number, options: Partial<Body3DOptions>): T;
  abstract createCylinder(radius: number, height: number, options: Partial<Body3DOptions>): T;
  abstract createCone(radius: number, height: number, options: Partial<Body3DOptions>): T;
  abstract createSphere(radius: number, options: Partial<Body3DOptions>): T;
  abstract createCompoundBody(items: BodyPrimitiveDescriptor[], options: Partial<Body3DOptions>): T;
  abstract createConvexHull(vertices: Point3[], options: Partial<Body3DOptions>): T;
  abstract createMesh(vertices: Point3[], faces: [number, number, number][], options: Partial<Body3DOptions>): T;

  createPrimitive(descriptor: BodyPrimitiveDescriptor): T {
    switch (descriptor.shape) {
      case 'BOX':
        return this.createBox(descriptor.dimensions, descriptor);
      case 'CAPSULE':
        return this.createCapsule(descriptor.radius, descriptor.centersDistance, descriptor);
      case 'CYLINDER':
        return this.createCylinder(descriptor.radius, descriptor.height, descriptor);
      case 'CONE':
        return this.createCone(descriptor.radius, descriptor.height, descriptor);
      case 'SPHERE':
        return this.createSphere(descriptor.radius, descriptor);
      case 'COMPOUND':
        return this.createCompoundBody(descriptor.children, descriptor);
      case 'CONVEX_HULL':
        return this.createConvexHull(descriptor.vertices, descriptor);
      case 'MESH':
        return this.createMesh(descriptor.vertices, descriptor.faces, descriptor);
    }
    throw new Error(`Body shape ${descriptor['shape']} creation not implemented`);
  };

}

export abstract class IGg3dBodyLoader {

  protected constructor(protected readonly world: IGg3dPhysicsWorld) {
  }

  async loadFromGgGlb(glbFile: ArrayBuffer, meta: GgMeta): Promise<IGg3dBody[]> {
    return (meta?.rigidBodies || []).map(d => {
      const body = this.world.factory.createPrimitive(d);
      body.name = d.name;
      return body;
    });
  }
}

// These interfaces have to be implemented for a particular 3D rendering engine
export interface IGg3dVisualScene extends GgVisualScene<Point3, Point4> {
  readonly factory: IGg3dObjectFactory;
  readonly loader: IGg3dObjectLoader;
}

export interface IGg3dObject extends GgObject<Point3, Point4> {
}

export interface IGg3dObjectFactory<T extends IGg3dObject = IGg3dObject> {
  createBox(dimensions: Point3): T;
  createCapsule(radius: number, centersDistance: number): T;
  createCylinder(radius: number, height: number): T;
  createCone(radius: number, height: number): T;
  createSphere(radius: number): T;
}

export interface IGg3dObjectLoader {
  loadFromGgGlb(glbFile: ArrayBuffer, meta: GgMeta): Promise<IGg3dObject | null>;
}
