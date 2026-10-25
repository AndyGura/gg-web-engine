import { IRenderer2dComponent, Point2, RendererOptions } from '@gg-web-engine/core';
import { Application, ApplicationOptions, Sprite, Texture } from 'pixi.js';
import type { WebGLRenderer } from 'pixi.js';
import { PixiSceneComponent } from './pixi-scene.component';
import { PixiCameraComponent } from './pixi-camera.component';
import { PixiGgWorld, PixiVisualTypeDocRepo2D } from '../types';
import { AsyncSubject, Observable, take } from 'rxjs';
import { PixiPhysicsDebugView } from './pixi-physics-debug-view';

export class PixiRendererComponent extends IRenderer2dComponent<PixiVisualTypeDocRepo2D> {
  public readonly application: Application;
  private _initialized: boolean = false;
  /** Set by a `dispose()` that came before pixi's async `init` finished; init then destroys. */
  private disposed: boolean = false;
  /** Emits once pixi's init has finished, also to late subscribers; completes empty on an earlier dispose. */
  private readonly onInitialized$: AsyncSubject<void> = new AsyncSubject();
  protected world: PixiGgWorld | null = null;

  /**
   * `true` once pixi's asynchronous `Application.init` has finished: from then on `application`'s
   * `renderer`, `canvas` and event system exist. Never `true` for a renderer disposed before that.
   */
  public get initialized(): boolean {
    return this._initialized;
  }

  /**
   * Emits once and completes when pixi's asynchronous `Application.init` has finished - right away
   * for a subscriber that comes later. Completes without emitting when the renderer is disposed
   * before that. Wait for it before using `application.renderer` (its event system, a render
   * texture, a bitmap font installed against it). Drawing and resizing don't need it: a `render()`
   * or `resizeRenderer()` before init runs once init is done.
   *
   * @example
   * ```ts
   * const renderer = world.addRenderer(camera, canvas, { transparent: true });
   * await firstValueFrom(renderer.renderer.initialized$);
   * renderer.renderer.application.renderer.events.cursorStyles.default = 'none';
   * ```
   */
  public get initialized$(): Observable<void> {
    return this.onInitialized$.asObservable();
  }

  private debugView: PixiPhysicsDebugView | null = null;
  /** Screen-fixed sprite showing the scene's background texture, when it has one. */
  private backgroundSprite: Sprite | null = null;
  /** The environment color currently overriding the renderer's clear color, `null` when none is. */
  private appliedClearColor: number | null = null;
  /** The clear color and alpha the renderer was created with, captured when first overridden. */
  private initialClear: { color: number; alpha: number } | null = null;
  private _physicsDebugViewActive: boolean = false;
  public get physicsDebugViewActive(): boolean {
    return this._physicsDebugViewActive;
  }

  public set physicsDebugViewActive(value: boolean) {
    if (this._physicsDebugViewActive == value) {
      return;
    }
    this._physicsDebugViewActive = value;
    if (this.world) {
      if (value) {
        this.debugView = new PixiPhysicsDebugView(this.world);
        this.application.stage.addChildAt(
          this.debugView.debugContainer,
          this.application.stage.getChildIndex(this.scene.nativeContainer!) + 1,
        );
      } else {
        this.debugView!.dispose();
        this.debugView = null;
      }
    }
  }

  constructor(
    public readonly scene: PixiSceneComponent,
    public camera: PixiCameraComponent,
    public readonly canvas?: HTMLCanvasElement,
    options: Partial<RendererOptions & ApplicationOptions> = {},
  ) {
    super(scene, canvas, options);
    this.application = new Application();
    this.application
      .init({
        canvas,
        backgroundAlpha: this.rendererOptions.transparent ? 0 : 1,
        // the canvas keeps its CSS size whatever the resolution
        autoDensity: true,
        resolution: this.initialResolution,
        width: 0,
        height: 0,
        backgroundColor: this.rendererOptions.background,
        // preventing ticks
        autoStart: false,
        sharedTicker: false,
        ...this.rendererOptions,
      })
      .then(() => {
        // GG uses own ticker, disable pixi ticker for this renderer
        this.application.ticker.stop();
        this.application.ticker.destroy();
        (this.application as any)._ticker = null!;
        if (this.disposed) {
          // disposed while initializing: what init just created (a GL context) is freed now
          this.application.destroy(this.nativeDestroyOptions, true);
          return;
        }
        this._initialized = true;
        this.onInitialized$.next();
        this.onInitialized$.complete();
      });
  }

  resizeRenderer(newSize: Point2): void {
    if (this._initialized) {
      this.application.renderer.resize(newSize.x, newSize.y);
    } else {
      this.onInitialized$.pipe(take(1)).subscribe(() => this.resizeRenderer(newSize));
    }
  }

  /**
   * Sets the native renderer's resolution, resizing its drawing buffer and keeping its size in CSS
   * pixels. Before pixi's async init has finished, the change is applied once it has.
   */
  setResolution(resolution: number): void {
    if (this.initialized) {
      const renderer = this.application.renderer;
      renderer.resize(renderer.width, renderer.height, resolution);
    } else {
      this.onInitialized$.pipe(take(1)).subscribe(() => this.setResolution(resolution));
    }
  }

  /** The native renderer's texture system once the renderer is initialized, `null` before. */
  public get nativeTextureSystem(): unknown {
    return this._initialized ? (this.application.renderer as any).texture : null;
  }

  addToWorld(world: PixiGgWorld): void {
    this.world = world;
    this.scene.renderers.add(this);
    this.application.stage.addChild(this.scene.requireNativeContainer('adding a renderer to the world'));
    if (this.physicsDebugViewActive) {
      this.debugView = new PixiPhysicsDebugView(world);
      this.application.stage.addChild(this.debugView.debugContainer);
    }
  }

  removeFromWorld(world: PixiGgWorld, dispose?: boolean): void {
    if (this.physicsDebugViewActive) {
      this.debugView!.dispose();
      this.debugView = null;
    }
    this.application.stage.removeChild(this.scene.nativeContainer!);
    this.scene.renderers.delete(this);
    this.world = null;
    if (dispose) {
      this.dispose();
    }
  }

  render(): void {
    if (this._initialized) {
      // no drawing while the WebGL context is lost (three.js skips it too): pixi would compile its
      // programs without uniforms then, and the uniform sync functions it keeps across the context
      // restore throw on every later frame. A WebGPU renderer has no `gl`.
      if ((this.application.renderer as WebGLRenderer).gl?.isContextLost()) {
        return;
      }
      if (this.debugView) {
        this.debugView.sync();
      }
      const width = this.application.renderer.width;
      const height = this.application.renderer.height;
      // the screen point the camera position is drawn at, which the view zooms and rotates around
      const topLeft = this.camera.origin === 'top-left';
      const originX = topLeft ? 0 : width / 2;
      const originY = topLeft ? 0 : height / 2;

      this.applyBackground(width, height);
      // a square around the camera position covering the whole view at any rotation: from the
      // view's center that is half its diagonal, from a corner the whole diagonal
      const halfExtent = Math.hypot(width, height) / (topLeft ? 1 : 2) / this.camera.zoom;
      for (const layer of this.scene.parallaxLayers) {
        layer.updateView(this.camera.position, { x: halfExtent, y: halfExtent });
      }

      const containers = [this.scene.nativeContainer, this.debugView?.debugContainer].filter(x => !!x);
      for (const container of containers) {
        container.pivot.x = 0;
        container.pivot.y = 0;
        container.scale.x = this.camera.zoom;
        container.scale.y = this.camera.zoom;
        container.pivot.x = this.camera.position.x;
        container.pivot.y = this.camera.position.y;
        container.rotation = -this.camera.rotation;
        container.position.x = originX;
        container.position.y = originY;
      }
      this.application.render();
    } else {
      this.onInitialized$.pipe(take(1)).subscribe(() => this.render());
    }
  }

  /**
   * Shows the scene's `environment.background`: a color becomes the renderer's clear color, a
   * texture a sprite behind the world container scaled to cover the whole canvas. Without one the
   * renderer keeps the clear color it was created with.
   */
  private applyBackground(width: number, height: number): void {
    const background = this.scene.environment.background;
    if (background instanceof Texture) {
      this.setClearColor(null);
      if (!this.backgroundSprite) {
        this.backgroundSprite = new Sprite();
        this.application.stage.addChildAt(this.backgroundSprite, 0);
      }
      const sprite = this.backgroundSprite;
      sprite.texture = background;
      const scale = Math.max(width / background.width, height / background.height);
      sprite.scale.set(scale);
      sprite.position.set((width - background.width * scale) / 2, (height - background.height * scale) / 2);
      return;
    }
    if (this.backgroundSprite) {
      this.backgroundSprite.destroy({ texture: false });
      this.backgroundSprite = null;
    }
    this.setClearColor(background ?? null);
  }

  /**
   * Overrides the renderer's clear color with `color`, or with `null` puts back the one the
   * renderer was created with. The alpha the renderer was created with is kept either way.
   */
  private setClearColor(color: number | null): void {
    if (this.appliedClearColor === color) {
      return;
    }
    this.appliedClearColor = color;
    const background = this.application.renderer.background;
    if (!this.initialClear) {
      this.initialClear = { color: background.color.toNumber(), alpha: background.alpha };
    }
    // pixi's color setter resets alpha to opaque
    background.color = color ?? this.initialClear.color;
    background.alpha = this.initialClear.alpha;
  }

  /**
   * A canvas the app passed in stays in the page (its layout is the app's), only a canvas pixi
   * created itself is removed. Either way pixi loses the WebGL context on destroy, so the canvas
   * can't host another renderer.
   */
  private get nativeDestroyOptions(): { removeView: boolean } {
    return { removeView: !this.canvas };
  }

  /**
   * Destroys the pixi application and with it the WebGL context of its canvas, right away instead
   * of at garbage collection (a page gets only about 16 contexts). The canvas can't host another
   * renderer afterwards: core's `replaceCanvas` puts a blank copy in its place for the next one.
   */
  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.scene.renderers.delete(this);
    this.backgroundSprite?.destroy({ texture: false });
    this.backgroundSprite = null;
    // nothing waiting for init (a deferred render or resize) runs any more
    this.onInitialized$.complete();
    if (this._initialized) {
      this.application.destroy(this.nativeDestroyOptions, true);
    }
    // otherwise pixi's Application can't be destroyed before its init resolves (its plugins
    // aren't set up yet), so the init callback does it
  }
}
