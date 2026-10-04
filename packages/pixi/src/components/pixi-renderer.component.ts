import { IRenderer2dComponent, Point2, RendererOptions } from '@gg-web-engine/core';
import { Application, ApplicationOptions, Sprite, Texture } from 'pixi.js';
import { PixiSceneComponent } from './pixi-scene.component';
import { PixiCameraComponent } from './pixi-camera.component';
import { PixiGgWorld, PixiVisualTypeDocRepo2D } from '../types';
import { first, Subject } from 'rxjs';
import { PixiPhysicsDebugView } from './pixi-physics-debug-view';

export class PixiRendererComponent extends IRenderer2dComponent<PixiVisualTypeDocRepo2D> {
  public readonly application: Application;
  private initialized: boolean = false;
  private onInitialized$: Subject<void> = new Subject();
  protected world: PixiGgWorld | null = null;

  private debugView: PixiPhysicsDebugView | null = null;
  /** Screen-fixed sprite showing the scene's background texture, when it has one. */
  private backgroundSprite: Sprite | null = null;
  private appliedClearColor: number | null = null;
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
        autoDensity: this.rendererOptions.forceResolution === undefined,
        resolution: this.rendererOptions.forceResolution || devicePixelRatio,
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
        this.initialized = true;
        this.onInitialized$.next();
        this.onInitialized$.complete();
      });
  }

  resizeRenderer(newSize: Point2): void {
    if (this.initialized) {
      this.application.renderer.resize(newSize.x, newSize.y);
    } else {
      this.onInitialized$.pipe(first()).subscribe(() => this.resizeRenderer(newSize));
    }
  }

  addToWorld(world: PixiGgWorld): void {
    this.world = world;
    this.application.stage.addChild(this.scene.nativeContainer!);
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
    this.world = null;
    if (dispose) {
      this.dispose();
    }
  }

  render(): void {
    if (this.initialized) {
      if (this.debugView) {
        this.debugView.sync();
      }
      const width = this.application.renderer.width;
      const height = this.application.renderer.height;
      const centerOffsetX = width / 2;
      const centerOffsetY = height / 2;

      this.applyBackground(width, height);
      const halfExtent = Math.hypot(width, height) / 2 / this.camera.zoom;
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
        container.position.x = centerOffsetX;
        container.position.y = centerOffsetY;
      }
      this.application.render();
    } else {
      this.onInitialized$.pipe(first()).subscribe(() => this.render());
    }
  }

  /**
   * Shows the scene's `environment.background`: a color becomes the renderer's clear color, a
   * texture a sprite behind the world container scaled to cover the whole canvas.
   */
  private applyBackground(width: number, height: number): void {
    const background = this.scene.environment.background;
    if (background instanceof Texture) {
      this.setClearColor(this.rendererOptions.background ?? 0x000000);
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
    this.setClearColor(background ?? this.rendererOptions.background ?? 0x000000);
  }

  private setClearColor(color: number): void {
    if (this.appliedClearColor === color) {
      return;
    }
    this.appliedClearColor = color;
    const background = this.application.renderer.background;
    // pixi's color setter resets alpha to opaque
    background.color = color;
    background.alpha = this.rendererOptions.transparent ? 0 : 1;
  }

  dispose(): void {
    this.backgroundSprite?.destroy({ texture: false });
    this.backgroundSprite = null;
    this.application.destroy(true, true);
  }
}
