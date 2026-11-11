import { Backdrop3dEntity, IRenderer3dComponent, Point2, Renderer3dOptions } from '@gg-web-engine/core';
import { Camera, PCFSoftShadowMap, PerspectiveCamera, WebGLRenderer, WebGLRendererParameters } from 'three';
import { Subscription } from 'rxjs';
import { ThreeSceneComponent } from './three-scene.component';
import { ThreeCameraComponent } from './three-camera.component';
import { ThreeGgWorld, ThreeVisualTypeDocRepo } from '../types';
import { ThreePhysicsDebugView } from './three-physics-debug-view';

/** A backdrop of a three.js world. */
export type ThreeBackdrop = Backdrop3dEntity<ThreeVisualTypeDocRepo>;

function isPerspective(camera: Camera): camera is PerspectiveCamera {
  return camera instanceof PerspectiveCamera || camera.type == 'PerspectiveCamera';
}

/**
 * Draws a `ThreeSceneComponent` through a camera onto a canvas. When the world has backdrops
 * (`Gg3dWorld.backdrops`, see `Backdrop3dEntity`), each frame is drawn in passes: every backdrop,
 * farthest first, through its camera posed from this renderer's (`poseCameraFor`, plus this
 * camera's aspect ratio), clearing depth after each; the farthest one also draws the world's sky,
 * lent by the world scene (`ThreeSceneComponent.lendBackgroundTo`); then the world scene, without
 * its sky. A world without backdrops, or a renderer with `drawBackdrops` off, renders in one pass,
 * as a plain `WebGLRenderer.render` of the world scene with its own sky.
 */
export class ThreeRendererComponent extends IRenderer3dComponent<ThreeVisualTypeDocRepo> {
  public readonly nativeRenderer: WebGLRenderer;
  protected world: ThreeGgWorld | null = null;

  protected debugView: ThreePhysicsDebugView | null = null;
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
        this.debugView = ThreePhysicsDebugView.startDebugView(this.world, this);
      } else {
        ThreePhysicsDebugView.stopDebugView(this.debugView!, this);
        this.debugView = null;
      }
    }
  }

  constructor(
    public readonly scene: ThreeSceneComponent,
    public camera: ThreeCameraComponent,
    public readonly canvas?: HTMLCanvasElement,
    rendererOptions: Partial<Renderer3dOptions & WebGLRendererParameters> = {},
  ) {
    super(scene, canvas, rendererOptions);
    this.nativeRenderer = new WebGLRenderer({
      canvas,
      alpha: this.rendererOptions.transparent,
      ...this.rendererOptions,
    });
    this.nativeRenderer.shadowMap.enabled = true;
    this.nativeRenderer.setClearColor(this.rendererOptions.background);
    this.nativeRenderer.shadowMap.type = PCFSoftShadowMap;
    this.nativeRenderer.setPixelRatio(this.initialResolution);
  }

  addToWorld(world: ThreeGgWorld) {
    this.world = world;
    this.scene.renderers.add(this);
    this.attachDrawnBackdrops();
    this.backdropTracking = new Subscription();
    this.backdropTracking.add(
      world.entityAdded$.subscribe(
        e => e instanceof Backdrop3dEntity && this.drawBackdrops && this.attachBackdrop(e as ThreeBackdrop),
      ),
    );
    this.backdropTracking.add(
      world.entityRemoved$.subscribe(e => e instanceof Backdrop3dEntity && this.detachBackdrop(e as ThreeBackdrop)),
    );
    if (this.physicsDebugViewActive) {
      this.debugView = ThreePhysicsDebugView.startDebugView(this.world, this);
    }
  }

  removeFromWorld(world: ThreeGgWorld, dispose?: boolean) {
    if (this.physicsDebugViewActive) {
      ThreePhysicsDebugView.stopDebugView(this.debugView!, this);
      this.debugView = null;
    }
    this.stopTrackingBackdrops();
    this.world = null;
    this.scene.renderers.delete(this);
    this.scene.releaseRenderer(this.nativeRenderer);
    if (dispose) {
      this.dispose();
    }
  }

  private backdropTracking: Subscription | null = null;
  /**
   * The backdrop scenes this renderer joined (`renderers`), for `ThreeLoader.prepare` and sky bakes:
   * those it draws, so a renderer with `drawBackdrops` off gets nothing of theirs uploaded.
   */
  private readonly backdropScenes: Map<ThreeBackdrop, ThreeSceneComponent> = new Map();

  /** Turned on, joins the scenes of the world's backdrops; turned off, leaves them all. */
  protected override onDrawBackdropsChanged(): void {
    if (this.drawBackdrops) {
      this.attachDrawnBackdrops();
    } else {
      this.detachAllBackdrops();
    }
  }

  /** Joins a backdrop's scene as one of its renderers. Overridden to add per-backdrop state. */
  protected attachBackdrop(backdrop: ThreeBackdrop): void {
    if (this.backdropScenes.has(backdrop)) {
      return;
    }
    const scene = backdrop.ownedScene as ThreeSceneComponent;
    this.backdropScenes.set(backdrop, scene);
    scene.renderers.add(this);
  }

  /** Leaves a backdrop's scene and frees what its skies baked with this renderer. */
  protected detachBackdrop(backdrop: ThreeBackdrop): void {
    const scene = this.backdropScenes.get(backdrop);
    if (!scene) {
      return;
    }
    this.backdropScenes.delete(backdrop);
    scene.renderers.delete(this);
    scene.releaseRenderer(this.nativeRenderer);
  }

  private attachDrawnBackdrops(): void {
    for (const backdrop of this.backdropsToDraw(this.world)) {
      this.attachBackdrop(backdrop);
    }
  }

  private detachAllBackdrops(): void {
    for (const backdrop of [...this.backdropScenes.keys()]) {
      this.detachBackdrop(backdrop);
    }
  }

  private stopTrackingBackdrops(): void {
    this.backdropTracking?.unsubscribe();
    this.backdropTracking = null;
    this.detachAllBackdrops();
  }

  /**
   * Poses `backdrop.camera` for this renderer's camera (`Backdrop3dEntity.poseCameraFor`) and gives
   * it this camera's aspect ratio. Backdrops share one camera between renderers, so this runs right
   * before every draw of a backdrop.
   */
  protected poseBackdropCamera(backdrop: ThreeBackdrop): void {
    backdrop.poseCameraFor(this.camera);
    const main = this.camera.nativeCamera;
    const own = backdrop.camera.nativeCamera;
    if (isPerspective(main) && isPerspective(own) && own.aspect !== main.aspect) {
      own.aspect = main.aspect;
      own.updateProjectionMatrix();
    }
  }

  resizeRenderer(newSize: Point2): void {
    this.nativeRenderer.setSize(newSize.x, newSize.y);
    // backdrop cameras take this aspect before each draw (`poseBackdropCamera`)
    if (isPerspective(this.camera.nativeCamera)) {
      const newAspect = newSize.x / newSize.y;
      if (Math.abs((this.camera.nativeCamera as PerspectiveCamera).aspect - newAspect) > 0.01) {
        (this.camera.nativeCamera as PerspectiveCamera).aspect = newSize.x / newSize.y;
        (this.camera.nativeCamera as PerspectiveCamera).updateProjectionMatrix();
      }
    }
  }

  /**
   * Sets the native renderer's pixel ratio; its drawing buffer is resized to match, its CSS size
   * stays as it is.
   */
  setResolution(resolution: number): void {
    this.nativeRenderer.setPixelRatio(resolution);
  }

  render(): void {
    const time = this.world?.worldClock.elapsedTime;
    this.scene.prepareFrame(this.nativeRenderer, time);
    const backdrops = this.backdropsToDraw(this.world);
    if (backdrops.length) {
      this.renderWithBackdrops(backdrops, time);
    } else {
      this.nativeRenderer.render(this.scene.nativeScene!, this.camera.nativeCamera);
    }
    if (this.physicsDebugViewActive) {
      this.debugView!.render(this.nativeRenderer, this.camera.nativeCamera);
    }
  }

  private renderWithBackdrops(backdrops: ReadonlyArray<ThreeBackdrop>, time: number | undefined): void {
    const renderer = this.nativeRenderer;
    const autoClear = renderer.autoClear;
    renderer.clear();
    renderer.autoClear = false;
    this.scene.lendBackgroundTo(backdrops[0].ownedScene as ThreeSceneComponent, this.world!.frame.yaw);
    try {
      for (const backdrop of backdrops) {
        const scene = backdrop.ownedScene as ThreeSceneComponent;
        if (!scene.nativeScene) {
          continue;
        }
        this.poseBackdropCamera(backdrop);
        scene.prepareFrame(renderer, time);
        renderer.render(scene.nativeScene, backdrop.camera.nativeCamera);
        renderer.clearDepth();
      }
      renderer.render(this.scene.nativeScene!, this.camera.nativeCamera);
    } finally {
      this.scene.takeBackgroundBack();
      renderer.autoClear = autoClear;
    }
  }

  /**
   * Frees the renderer and gives its WebGL context back to the browser right away, instead of
   * leaving that to garbage collection - a page gets only so many contexts (about 16), and an app
   * that creates a world per game session would run out. The canvas can't be used for another
   * renderer afterwards: core's `replaceCanvas` puts a blank copy in its place for the next one.
   */
  dispose(): void {
    this.stopTrackingBackdrops();
    this.scene.renderers.delete(this);
    this.scene.releaseRenderer(this.nativeRenderer);
    this.camera.dispose();
    this.nativeRenderer.clear();
    this.nativeRenderer.dispose();
    this.nativeRenderer.forceContextLoss();
    this.nativeRenderer.domElement = null as any;
  }
}
