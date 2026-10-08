import { BodyShape3DDescriptor, Shape3DDescriptor, Shape3DMeshDescriptor } from './models/shapes';
import { IAudioSourceComponentFactory, Point3, Point4 } from '../base';
import { LoadTextureOptions } from './models/environment';
import { AudioTypeDocRepo3D, PhysicsTypeDocRepo3D, VisualTypeDocRepo3D } from './gg-3d-world';
import { AudioSource3dDescriptor } from './components/audio/i-audio-source-3d.component';
import { CharacterController3dOptions } from './models/character-controller-options';
import { Light3dDescriptor } from './models/lights';

export type DisplayObject3dOpts<Tex> = {
  color?: number;
  shading?: 'unlit' | 'standart' | 'phong' | 'wireframe';
  diffuse?: Tex;
  castShadow?: boolean;
  receiveShadow?: boolean;
  /**
   * Opacity from `0` (invisible) to `1` (opaque, the default). Anything below `1` makes the
   * material render as transparent.
   */
  opacity?: number;
};

export abstract class IDisplayObject3dComponentFactory<VTypeDoc extends VisualTypeDocRepo3D = VisualTypeDocRepo3D> {
  abstract createPrimitive(
    descriptor: Shape3DMeshDescriptor,
    material?: DisplayObject3dOpts<VTypeDoc['texture']>,
  ): VTypeDoc['displayObject'];

  abstract createPerspectiveCamera(settings?: {
    fov?: number;
    aspectRatio?: number;
    frustrum?: { near: number; far: number };
  }): VTypeDoc['camera'];

  /**
   * Creates a light. Wrap it in a `Light3dEntity` (or use `Gg3dWorld.addLight`) to add it to a world.
   */
  abstract createLight(descriptor: Light3dDescriptor): VTypeDoc['light'];

  /**
   * Creates a texture from a canvas the app has drawn on, e.g. a procedurally generated pattern,
   * for `DisplayObject3dOpts.diffuse`. The canvas is read once, now: drawing on it afterwards
   * doesn't update the texture. To load an image file instead, see
   * `IDisplayObject3dComponentLoader.loadTexture`.
   */
  abstract createTextureFromCanvas(canvas: HTMLCanvasElement, options?: LoadTextureOptions): VTypeDoc['texture'];

  randomColor(): number {
    return (
      (Math.floor(Math.random() * 256) << 16) | (Math.floor(Math.random() * 256) << 8) | Math.floor(Math.random() * 256)
    );
  }

  // shortcuts
  createPlane(material: DisplayObject3dOpts<VTypeDoc['texture']> = {}): VTypeDoc['displayObject'] {
    return this.createPrimitive({ shape: 'PLANE' }, material);
  }

  createBox(dimensions: Point3, material: DisplayObject3dOpts<VTypeDoc['texture']> = {}): VTypeDoc['displayObject'] {
    return this.createPrimitive({ shape: 'BOX', dimensions }, material);
  }

  createCapsule(
    radius: number,
    centersDistance: number,
    material: DisplayObject3dOpts<VTypeDoc['texture']> = {},
  ): VTypeDoc['displayObject'] {
    return this.createPrimitive({ shape: 'CAPSULE', radius, centersDistance }, material);
  }

  createCylinder(
    radius: number,
    height: number,
    material: DisplayObject3dOpts<VTypeDoc['texture']> = {},
  ): VTypeDoc['displayObject'] {
    return this.createPrimitive({ shape: 'CYLINDER', radius, height }, material);
  }

  createCone(
    radius: number,
    height: number,
    material: DisplayObject3dOpts<VTypeDoc['texture']> = {},
  ): VTypeDoc['displayObject'] {
    return this.createPrimitive({ shape: 'CONE', radius, height }, material);
  }

  createSphere(radius: number, material: DisplayObject3dOpts<VTypeDoc['texture']> = {}): VTypeDoc['displayObject'] {
    return this.createPrimitive({ shape: 'SPHERE', radius }, material);
  }
}

export interface IPhysicsBody3dComponentFactory<PTypeDoc extends PhysicsTypeDocRepo3D = PhysicsTypeDocRepo3D> {
  createRigidBody(
    descriptor: BodyShape3DDescriptor,
    transform?: {
      position?: Point3;
      rotation?: Point4;
    },
  ): PTypeDoc['rigidBody'];

  createTrigger(
    descriptor: Shape3DDescriptor,
    transform?: {
      position?: Point3;
      rotation?: Point4;
    },
  ): PTypeDoc['trigger'];

  createRaycastVehicle(chassis: PTypeDoc['rigidBody']): PTypeDoc['raycastVehicle'];

  createCharacterController(
    options: CharacterController3dOptions,
    transform?: {
      position?: Point3;
      rotation?: Point4;
    },
  ): PTypeDoc['characterController'];
}

export interface IAudioSource3dComponentFactory<
  ATypeDoc extends AudioTypeDocRepo3D = AudioTypeDocRepo3D,
> extends IAudioSourceComponentFactory<Point3, Point4, ATypeDoc> {
  /** Narrows the base `createSource` to take the 3D-only `panningModel` as well. */
  createSource(descriptor: AudioSource3dDescriptor<ATypeDoc['clip']>): ATypeDoc['source'];
}
