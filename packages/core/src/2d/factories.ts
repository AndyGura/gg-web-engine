import { IAudioSourceComponentFactory, Point2, TextureOptions } from '../base';
import { BodyShape2DDescriptor, Shape2DDescriptor } from './models/shapes';
import { AudioTypeDocRepo2D, PhysicsTypeDocRepo2D, VisualTypeDocRepo2D } from './gg-2d-world';
import { CharacterController2dOptions } from './models/character-controller-options';
import { ParallaxLayer2dOpts } from './models/environment';
import { Text2dStyle } from './models/text';

export type DisplayObject2dOpts<Tex> = {
  /** Fill color of an untextured shape; with a `texture`, a tint multiplied over it instead. */
  color?: number;
  texture?: Tex;
  /** An outline around an untextured shape. Ignored for a textured one. */
  stroke?: { color: number; width: number };
  /** Opacity from `0` (invisible) to `1` (opaque, the default), see `IDisplayObject2dComponent.opacity`. */
  opacity?: number;
};

export abstract class IDisplayObject2dComponentFactory<VTypeDoc extends VisualTypeDocRepo2D = VisualTypeDocRepo2D> {
  abstract createPrimitive(
    descriptor: Shape2DDescriptor,
    material?: DisplayObject2dOpts<VTypeDoc['texture']>,
  ): VTypeDoc['displayObject'];

  /**
   * Creates a parallax layer (see `ParallaxLayer2dOpts`). Wrap it in a `ParallaxLayer2dEntity` (or
   * use `Gg2dWorld.addParallaxLayer`) to add it to a world.
   */
  abstract createParallaxLayer(options: ParallaxLayer2dOpts<VTypeDoc['texture']>): VTypeDoc['parallaxLayer'];

  /** Loads an image as a texture, for `DisplayObject2dOpts.texture`, a parallax layer or a background. */
  abstract loadTexture(url: string, options?: TextureOptions): Promise<VTypeDoc['texture']>;

  /**
   * Decodes a texture from an already-fetched image file - what `loadTexture` does after its own
   * fetch. `world.loader.loadTexture` fetches the file itself (reporting progress, cancellable) and
   * hands it over here. A factory without this method has its `loadTexture` called instead, and the
   * fetch then goes unreported.
   */
  textureFromData?(data: Blob, options?: TextureOptions): Promise<VTypeDoc['texture']>;

  /** Frees a texture made by `loadTexture`/`textureFromData`, once nothing shows it anymore. */
  disposeTexture?(texture: VTypeDoc['texture']): void;

  /**
   * Finishes whatever of a loaded texture would otherwise happen at its first render (GPU upload),
   * so `world.loader` can count it as part of the load. Resolves at once when there is nothing to
   * do it with yet (no renderer in the scene).
   */
  prepare?(texture: VTypeDoc['texture']): Promise<void>;

  /**
   * Creates a texture from a canvas the app has drawn on, e.g. a procedurally generated backdrop.
   * The canvas is read once, now: drawing on it afterwards doesn't update the texture.
   */
  abstract createTextureFromCanvas(canvas: HTMLCanvasElement, options?: TextureOptions): VTypeDoc['texture'];

  /** Creates a text object, see `IText2dComponent` and `Text2dStyle`. */
  abstract createText(text: string, style?: Text2dStyle): VTypeDoc['text'];

  /**
   * Creates a camera, to pass to `Gg2dWorld.addRenderer`. Its `position` is the world point shown
   * at the center of the renderer's view, and `zoom` scales the view around it (see
   * `ICamera2dComponent`).
   */
  abstract createCamera(): VTypeDoc['camera'];

  randomColor(): number {
    return (
      (Math.floor(Math.random() * 256) << 16) | (Math.floor(Math.random() * 256) << 8) | Math.floor(Math.random() * 256)
    );
  }

  // shortcuts
  createBox(dimensions: Point2, material: DisplayObject2dOpts<VTypeDoc['texture']> = {}): VTypeDoc['displayObject'] {
    return this.createPrimitive({ shape: 'BOX', dimensions }, material);
  }

  createCircle(radius: number, material: DisplayObject2dOpts<VTypeDoc['texture']> = {}): VTypeDoc['displayObject'] {
    return this.createPrimitive({ shape: 'CIRCLE', radius }, material);
  }

  createCapsule(
    radius: number,
    centersDistance: number,
    material: DisplayObject2dOpts<VTypeDoc['texture']> = {},
  ): VTypeDoc['displayObject'] {
    return this.createPrimitive({ shape: 'CAPSULE', radius, centersDistance }, material);
  }

  createConvexHull(
    vertices: Point2[],
    material: DisplayObject2dOpts<VTypeDoc['texture']> = {},
  ): VTypeDoc['displayObject'] {
    return this.createPrimitive({ shape: 'CONVEX_HULL', vertices }, material);
  }

  createPolygon(
    vertices: Point2[],
    material: DisplayObject2dOpts<VTypeDoc['texture']> = {},
  ): VTypeDoc['displayObject'] {
    return this.createPrimitive({ shape: 'POLYGON', vertices }, material);
  }
}

export interface IPhysicsBody2dComponentFactory<PTypeDoc extends PhysicsTypeDocRepo2D = PhysicsTypeDocRepo2D> {
  createRigidBody(
    descriptor: BodyShape2DDescriptor,
    transform?: {
      position?: Point2;
      rotation?: number;
    },
  ): PTypeDoc['rigidBody'];

  createTrigger(
    descriptor: Shape2DDescriptor,
    transform?: {
      position?: Point2;
      rotation?: number;
    },
  ): PTypeDoc['trigger'];

  createCharacterController(
    options: CharacterController2dOptions,
    transform?: {
      position?: Point2;
      rotation?: number;
    },
  ): PTypeDoc['characterController'];
}

export interface IAudioSource2dComponentFactory<
  ATypeDoc extends AudioTypeDocRepo2D = AudioTypeDocRepo2D,
> extends IAudioSourceComponentFactory<Point2, number, ATypeDoc> {}
