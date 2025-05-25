import { IRenderer2dComponent, Point2, RendererOptions } from '@gg-web-engine/core';
import { Application, ApplicationOptions } from 'pixi.js';
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

  removeFromWorld(world: PixiGgWorld): void {
    if (this.physicsDebugViewActive) {
      this.debugView!.dispose();
      this.debugView = null;
    }
    this.application.stage.removeChild(this.scene.nativeContainer!);
    this.world = null;
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

  dispose(): void {
    this.application.destroy(true, true);
  }
}
