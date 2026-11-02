import { Environment2dOpts, IVisualScene2dComponent, notInitializedError, RendererOptions } from '@gg-web-engine/core';
import { ApplicationOptions, Container, Texture } from 'pixi.js';
import type { PixiParallaxLayerComponent } from './pixi-parallax-layer.component';
import { PixiFactory } from '../pixi-factory';
import { PixiCameraComponent } from './pixi-camera.component';
import { PixiRendererComponent } from './pixi-renderer.component';
import { PixiVisualTypeDocRepo2D } from '../types';
import { markWorldContainer } from '../utils/world-container';

/** Options of a `PixiSceneComponent`. */
export type PixiSceneOptions = {
  /**
   * The scene's texel density: how many screen pixels one meter of the world covers at camera
   * `zoom` 1, and so how many texels of an image fit in a meter. A texture's natural size is its
   * size in texels over this (a 48x72 px sprite is 0.48x0.72 m at the default `100`), and a
   * Graphics primitive or a text is rasterized at this density. Use `1` for a UI/HUD world laid out
   * in canvas pixels, together with a `'top-left'` camera. Default `100`.
   */
  pixelsPerMeter?: number;
};

/**
 * The pixi.js (v8) visual scene of a `Gg2dWorld`: pass a new one as `visualScene`. Its `factory`
 * creates shapes, sprites, text and the camera; the pixi `Container` holding the world is
 * `nativeContainer` once the world is initialized. The world is measured in meters; the scene's
 * `pixelsPerMeter` (default 100) says how many screen pixels a meter covers at camera `zoom` 1.
 *
 * @example
 * ```ts
 * import { Gg2dWorld } from '@gg-web-engine/core';
 * import { PixiGgWorld, PixiSceneComponent } from '@gg-web-engine/pixi';
 *
 * const world: PixiGgWorld = new Gg2dWorld({ visualScene: new PixiSceneComponent() }); // rendering only
 * await world.init();
 * world.visualScene.setEnvironment({ background: 0x203040 });
 * const label = world.visualScene.factory.createText('Hello', { fontSize: 32, color: 0xffffff });
 *
 * // a HUD world in canvas pixels
 * const hud = new Gg2dWorld({ visualScene: new PixiSceneComponent({ pixelsPerMeter: 1 }) });
 * ```
 */
export class PixiSceneComponent implements IVisualScene2dComponent<PixiVisualTypeDocRepo2D> {
  public readonly backendName: string = 'pixi';

  /**
   * Screen pixels per meter at camera `zoom` 1 - the texel density every display object of this
   * scene is sized with (see `PixiSceneOptions.pixelsPerMeter`).
   */
  public readonly pixelsPerMeter: number;

  private _nativeContainer: Container | null = null;
  public get nativeContainer(): Container | null {
    return this._nativeContainer;
  }

  /**
   * The native world container, for code that needs it to exist: throws an error naming the fix
   * (await `world.init()`) instead of silently dropping whatever was meant to go into it before
   * `init()`.
   */
  public requireNativeContainer(action: string): Container {
    if (!this._nativeContainer) {
      throw notInitializedError('PixiSceneComponent', 'visualScene', action);
    }
    return this._nativeContainer;
  }

  public readonly factory: PixiFactory = new PixiFactory(this);

  /** The renderers currently drawing this scene - what `PixiFactory.prepare` uploads to. */
  public readonly renderers: Set<PixiRendererComponent> = new Set();

  constructor(options: PixiSceneOptions = {}) {
    const pixelsPerMeter = options.pixelsPerMeter ?? 100;
    if (!(pixelsPerMeter > 0)) {
      throw new Error(`PixiSceneComponent: pixelsPerMeter must be a positive number, got ${pixelsPerMeter}`);
    }
    this.pixelsPerMeter = pixelsPerMeter;
  }

  /** Parallax layers currently in this scene - each renderer positions them for its own camera. */
  public readonly parallaxLayers: Set<PixiParallaxLayerComponent> = new Set();

  async init(): Promise<void> {
    // draw order follows `zIndex` (see `IDisplayObject2dComponent.zIndex`)
    this._nativeContainer = new Container({ sortableChildren: true });
    markWorldContainer(this._nativeContainer);
  }

  private _environment: Environment2dOpts<Texture> = { background: null };
  /** Applied by each renderer when it draws - see `PixiRendererComponent.render`. */
  public get environment(): Readonly<Environment2dOpts<Texture>> {
    return this._environment;
  }

  setEnvironment(environment: Partial<Environment2dOpts<Texture>>): void {
    this._environment = { ...this._environment, ...environment };
  }

  createRenderer(
    camera: PixiCameraComponent,
    canvas?: HTMLCanvasElement,
    rendererOptions?: Partial<RendererOptions & ApplicationOptions>,
  ): PixiRendererComponent {
    return new PixiRendererComponent(this, camera, canvas, rendererOptions);
  }

  dispose(): void {
    this._nativeContainer?.destroy();
    this._nativeContainer = null;
    this.parallaxLayers.clear();
    this._environment = { background: null };
  }
}
