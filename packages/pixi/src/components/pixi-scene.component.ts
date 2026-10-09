import { Environment2dOpts, IVisualScene2dComponent, notInitializedError, RendererOptions } from '@gg-web-engine/core';
import { ApplicationOptions, Container, Texture } from 'pixi.js';
import type { PixiParallaxLayerComponent } from './pixi-parallax-layer.component';
import { PixiFactory } from '../pixi-factory';
import { PixiCameraComponent } from './pixi-camera.component';
import { PixiRendererComponent } from './pixi-renderer.component';
import { PixiVisualTypeDocRepo2D } from '../types';

export class PixiSceneComponent implements IVisualScene2dComponent<PixiVisualTypeDocRepo2D> {
  public readonly backendName: string = 'pixi';

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

  constructor() {}

  /** Parallax layers currently in this scene - each renderer positions them for its own camera. */
  public readonly parallaxLayers: Set<PixiParallaxLayerComponent> = new Set();

  async init(): Promise<void> {
    // draw order follows `zIndex` (see `IDisplayObject2dComponent.zIndex`)
    this._nativeContainer = new Container({ sortableChildren: true });
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
