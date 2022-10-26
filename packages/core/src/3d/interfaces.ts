import { GgBody } from '../base/interfaces/gg-body';
import { Point3, Point4 } from '../base/models/points';
import { GgObject } from '../base/interfaces/gg-object';
import { GgPhysicsWorld } from '../base/interfaces/gg-physics-world';
import { GgVisualScene } from '../base/interfaces/gg-visual-scene';

// These interfaces have to be implemented for a particular 3D physics engine
export interface IGg3dPhysicsWorld extends GgPhysicsWorld<Point3, Point4> {
  readonly factory: IGg3dBodyFactory;
}
export interface IGg3dBody extends GgBody<Point3, Point4> {}
export interface IGg3dBodyFactory {
  createBox(width: number, length: number, height: number, mass: number): IGg3dBody;
  createSphere(radius: number, mass: number): IGg3dBody;
}

// These interfaces have to be implemented for a particular 3D rendering engine
export interface IGg3dVisualScene extends GgVisualScene<Point3, Point4> {
  readonly factory: IGg3dObjectFactory;
}
export interface IGg3dObject extends GgObject<Point3, Point4> {}
export interface IGg3dObjectFactory {
  createBox(width: number, length: number, height: number): IGg3dObject;
  createSphere(radius: number): IGg3dObject;
}
