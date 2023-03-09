import { GgBody } from '../base/interfaces/gg-body';
import { Point3, Point4 } from '../base/models/points';
import { GgObject } from '../base/interfaces/gg-object';
import { GgPhysicsWorld } from '../base/interfaces/gg-physics-world';
import { GgVisualScene } from '../base/interfaces/gg-visual-scene';
import { GgMeta } from './models/gg-meta';
import { BaseGgRenderer } from '../base/entities/base-gg-renderer';
import { Gg3dCameraEntity } from './entities/gg-3d-camera.entity';
import { GgWorld } from '../base/gg-world';
import { SuspensionOptions, WheelOptions } from './entities/gg-3d-raycast-vehicle.entity';
import { GgTrigger } from '../base/interfaces/gg-trigger';
import { BodyShape3DDescriptor, Shape3DDescriptor } from './models/shapes';
import { Observable } from 'rxjs';
import { GgPositionable3dEntity } from './entities/gg-positionable-3d-entity';

// These interfaces have to be implemented for a particular 3D physics engine
export interface IGg3dPhysicsWorld extends GgPhysicsWorld<Point3, Point4> {
  readonly factory: IGg3dBodyFactory;
  readonly loader: IGg3dBodyLoader;
}

export abstract class Gg3dRenderer extends BaseGgRenderer {
  abstract readonly camera: Gg3dCameraEntity;

  public onSpawned(world: GgWorld<any, any>) {
    super.onSpawned(world);
    world.addEntity(this.camera);
  }

  onRemoved() {
    super.onRemoved();
    this.world?.removeEntity(this.camera);
  }
}

export interface IGg3dBody extends GgBody<Point3, Point4> {
}

export interface IGg3dTrigger extends GgTrigger<Point3, Point4> {
  get onEntityEntered(): Observable<GgPositionable3dEntity>;
  get onEntityLeft(): Observable<GgPositionable3dEntity>;
}

export interface IGg3dRaycastVehicle extends IGg3dBody {
  /** Return speed in m/s, calculated by car itself (which should be shown on the speedometer) */
  get wheelSpeed(): number;

  addWheel(options: WheelOptions, suspensionOptions: SuspensionOptions): void;

  /** Set steering value for wheel. The unit of steering is radian */
  setSteering(wheelIndex: number, steering: number): void;

  /** Apply force to wheel. Units? */
  applyEngineForce(wheelIndex: number, force: number): void;

  /** Apply brake force to wheel. Units? */
  applyBrake(wheelIndex: number, force: number): void;

  isWheelTouchesGround(wheelIndex: number): boolean;

  getWheelTransform(wheelIndex: number): { position: Point3, rotation: Point4 };

  resetSuspension(): void;
}

export interface IGg3dBodyFactory<T extends IGg3dBody = IGg3dBody, K extends IGg3dTrigger = IGg3dTrigger> {

  createPrimitiveBody(descriptor: BodyShape3DDescriptor): T;

  createTrigger(descriptor: Shape3DDescriptor): K;
}

export abstract class IGg3dBodyLoader {

  protected constructor(protected readonly world: IGg3dPhysicsWorld) {
  }

  async loadFromGgGlb(glbFile: ArrayBuffer, meta: GgMeta): Promise<IGg3dBody[]> {
    return (meta?.rigidBodies || []).map(d => {
      const body = this.world.factory.createPrimitiveBody(d);
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

export interface IGg3dCamera extends IGg3dObject {
  get supportsFov(): boolean;
  get fov(): number;
  set fov(f: number);
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
