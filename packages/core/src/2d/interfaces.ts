import { GgBody } from '../base/interfaces/gg-body';
import { Point2 } from '../base/models/points';
import { GgObject } from '../base/interfaces/gg-object';
import { GgPhysicsWorld } from '../base/interfaces/gg-physics-world';
import { GgVisualScene } from '../base/interfaces/gg-visual-scene';

// These interfaces have to be implemented for a particular 2D physics engine
export interface IGg2dPhysicsWorld extends GgPhysicsWorld<Point2, number> {
  readonly factory: IGg2dBodyFactory;
}
export interface IGg2dBody extends GgBody<Point2, number> {}
export interface IGg2dBodyFactory {
  createSquare(width: number, height: number, mass: number): IGg2dBody;
  createCircle(radius: number, mass: number): IGg2dBody;
}

// These interfaces have to be implemented for a particular 2D rendering engine
export interface IGg2dVisualScene extends GgVisualScene<Point2, number> {
  readonly factory: IGg2dObjectFactory;
}
export interface IGg2dObject extends GgObject<Point2, number> {}
export interface IGg2dObjectFactory {
  createSquare(width: number, height: number): IGg2dObject;
  createCircle(radius: number): IGg2dObject;
}
