import { GgBody } from '../base/interfaces/gg-body';
import { Point2 } from '../base/models/points';
import { GgObject } from '../base/interfaces/gg-object';
import { GgPhysicsWorld } from '../base/interfaces/gg-physics-world';
import { GgVisualScene } from '../base/interfaces/gg-visual-scene';
import { BaseGgRenderer } from '../base/entities/base-gg-renderer';
import { GgTrigger } from '../base/interfaces/gg-trigger';
import { BodyShape2DDescriptor, Shape2DDescriptor } from './models/shapes';
import { Observable } from 'rxjs';
import { GgPositionable2dEntity } from './entities/gg-positionable-2d-entity';

// These interfaces have to be implemented for a particular 2D physics engine
export interface IGg2dPhysicsWorld extends GgPhysicsWorld<Point2, number> {
  readonly factory: IGg2dBodyFactory;
}

export abstract class Gg2dRenderer extends BaseGgRenderer {
}

export interface IGg2dBody extends GgBody<Point2, number> {
}

export interface IGg2dTrigger extends GgTrigger<Point2, number> {
  get onEntityEntered(): Observable<GgPositionable2dEntity>;
}

export interface IGg2dBodyFactory<T extends IGg2dBody = IGg2dBody, K extends IGg2dTrigger = IGg2dTrigger> {
  createPrimitiveBody(descriptor: BodyShape2DDescriptor): T;
  createTrigger(descriptor: Shape2DDescriptor): K;
}

// These interfaces have to be implemented for a particular 2D rendering engine
export interface IGg2dVisualScene extends GgVisualScene<Point2, number> {
  readonly factory: IGg2dObjectFactory;
}

export interface IGg2dObject extends GgObject<Point2, number> {
}

export interface IGg2dObjectFactory {
  createSquare(dimensions: Point2): IGg2dObject;
  createCircle(radius: number): IGg2dObject;
}
