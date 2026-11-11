import { Backdrop3dEntity, IRenderer3dComponent, Point2, Renderer3dOptions } from '@gg-web-engine/core';
import { Camera, PCFSoftShadowMap, PerspectiveCamera, Vector2, WebGLRenderer, WebGLRendererParameters } from 'three';
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

/** What a renderer keeps for each backdrop it draws. */
type AttachedBackdrop = {
  /** The backdrop's scene, joined as one of its `renderers` (for `ThreeLoader.prepare` and sky bakes). */
  scene: ThreeSceneComponent;
  /** The renderer's own camera for the backdrop (`Backdrop3dEntity.createCamera`). */
  camera: ThreeCameraComponent;
};

/** The `PerspectiveCamera` fields `copyProjection` copies as they are. */
const PROJECTION_FIELDS = ['fov', 'aspect', 'zoom', 'filmGauge', 'filmOffset'] as const;
/** The sizes of a `PerspectiveCamera.view` (the view offset). */
const VIEW_FIELDS = ['fullWidth', 'fullHeight', 'offsetX', 'offsetY', 'width', 'height'] as const;

/**
 * Gives `to` every setting of `from` its projection matrix depends on (see
 * `PerspectiveCamera.updateProjectionMatrix`) but `near`/`far`, which stay `to`'s own: `fov`,
 * `aspect`, `zoom`, the film offset (`filmOffset`, scaled by `filmGauge`) and the view offset
 * (`view`, from `setViewOffset`). `focus` only matters to a `StereoCamera`. Returns whether anything
 * changed; it never calls `updateProjectionMatrix` itself.
 */
function copyProjection(from: PerspectiveCamera, to: PerspectiveCamera): boolean {
  let changed = copyViewOffset(from, to);
  for (const key of PROJECTION_FIELDS) {
    if (to[key] !== from[key]) {
      to[key] = from[key];
      changed = true;
    }
  }
  return changed;
}

/**
 * Copies the view offset of `from` into `to`'s own `view` object (never shared: `setViewOffset`
 * changes it in place). A disabled or missing one is the same projection either way. Returns whether
 * the projection changed.
 */
function copyViewOffset(from: PerspectiveCamera, to: PerspectiveCamera): boolean {
  const view = from.view?.enabled ? from.view : null;
  const own = to.view;
  if (!view) {
    if (!own?.enabled) {
      return false;
    }
    own.enabled = false;
    return true;
  }
  if (!own) {
    to.view = { ...view };
    return true;
  }
  let changed = !own.enabled;
  own.enabled = true;
  for (const key of VIEW_FIELDS) {
    if (own[key] !== view[key]) {
      own[key] = view[key];
      changed = true;
    }
  }
  return changed;
}

/**
 * The `aspect` that makes what `camera` draws as wide as `canvasAspect` says: `canvasAspect`
 * itself, or with a view offset, that of the full view the drawn window is a part of -
 * `canvasAspect * (fullWidth / width) / (fullHeight / height)`, which is `setViewOffset`'s own
 * `fullWidth / fullHeight` while the window has the canvas's shape.
 */
function aspectForCanvas(camera: PerspectiveCamera, canvasAspect: number): number {
  const view = camera.view;
  if (!view?.enabled) {
    return canvasAspect;
  }
  return (canvasAspect * view.fullWidth * view.height) / (view.width * view.fullHeight);
}

/**
 * Draws a `ThreeSceneComponent` through a camera onto a canvas. When the world has backdrops
 * (`Gg3dWorld.backdrops`, see `Backdrop3dEntity`), each frame is drawn in passes: every backdrop,
 * farthest first, through this renderer's own camera for it (`backdropCamera`), given this
 * renderer camera's projection and posed from it (`poseBackdropCamera`), clearing depth after each;
 * the farthest one also draws the world's sky, lent by the world scene
 * (`ThreeSceneComponent.lendBackgroundTo`); then the world scene, without its sky. A world without
 * backdrops, or a renderer with `drawBackdrops` off, renders in one pass, as a plain
 * `WebGLRenderer.render` of the world scene with its own sky.
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
   * What this renderer keeps per backdrop it draws: only those, so a renderer with `drawBackdrops`
   * off joins no backdrop scene and gets nothing of theirs uploaded.
   */
  private readonly attachedBackdrops: Map<ThreeBackdrop, AttachedBackdrop> = new Map();
  /** Scratch for `copyCanvasAspect`. */
  private readonly canvasSize = new Vector2();

  /** Turned on, joins the scenes of the world's backdrops; turned off, leaves them all. */
  protected override onDrawBackdropsChanged(): void {
    if (this.drawBackdrops) {
      this.attachDrawnBackdrops();
    } else {
      this.detachAllBackdrops();
    }
  }

  /**
   * This renderer's camera for `backdrop`, created when the renderer starts drawing it (it joins
   * the world, the backdrop does, or `drawBackdrops` is turned on) and disposed when it stops. Its
   * pose and every projection setting `poseBackdropCamera` copies are rewritten before each draw;
   * anything else on it (its render `layers`) stays as set. `undefined` for a backdrop this renderer
   * doesn't draw.
   */
  public backdropCamera(backdrop: ThreeBackdrop): ThreeCameraComponent | undefined {
    return this.attachedBackdrops.get(backdrop)?.camera;
  }

  /**
   * Joins a backdrop's scene as one of its renderers and creates this renderer's camera for it.
   * Overridden to add per-backdrop state.
   */
  protected attachBackdrop(backdrop: ThreeBackdrop): void {
    if (this.attachedBackdrops.has(backdrop)) {
      return;
    }
    const scene = backdrop.ownedScene as ThreeSceneComponent;
    this.attachedBackdrops.set(backdrop, { scene, camera: backdrop.createCamera() });
    scene.renderers.add(this);
  }

  /**
   * Leaves a backdrop's scene, frees what its skies baked with this renderer and disposes this
   * renderer's camera for it.
   */
  protected detachBackdrop(backdrop: ThreeBackdrop): void {
    const attached = this.attachedBackdrops.get(backdrop);
    if (!attached) {
      return;
    }
    this.attachedBackdrops.delete(backdrop);
    attached.scene.renderers.delete(this);
    attached.scene.releaseRenderer(this.nativeRenderer);
    attached.camera.dispose();
  }

  private attachDrawnBackdrops(): void {
    for (const backdrop of this.backdropsToDraw(this.world)) {
      this.attachBackdrop(backdrop);
    }
  }

  private detachAllBackdrops(): void {
    for (const backdrop of [...this.attachedBackdrops.keys()]) {
      this.detachBackdrop(backdrop);
    }
  }

  private stopTrackingBackdrops(): void {
    this.backdropTracking?.unsubscribe();
    this.backdropTracking = null;
    this.detachAllBackdrops();
  }

  /**
   * Readies `camera`, this renderer's camera for `backdrop` (`backdropCamera`), for a draw. First the
   * projection: from a perspective camera, every setting its projection depends on but the near and
   * far planes, which stay the backdrop's `frustum` - `fov`, aspect ratio, `zoom`, view offset
   * (`setViewOffset`) and film offset - so the backdrop's horizon and scale line up with the
   * world's; for any other camera (no fov to copy), this canvas's aspect ratio. The projection is
   * recomputed only when one of those changed since the last draw. Then the pose
   * (`Backdrop3dEntity.poseCameraFor`), which finds the fov already copied.
   */
  protected poseBackdropCamera(backdrop: ThreeBackdrop, camera: ThreeCameraComponent): void {
    const main = this.camera.nativeCamera;
    const own = camera.nativeCamera;
    if (isPerspective(own) && (isPerspective(main) ? copyProjection(main, own) : this.copyCanvasAspect(own))) {
      own.updateProjectionMatrix();
    }
    backdrop.poseCameraFor(this.camera, camera);
  }

  /** Gives `camera` this canvas's aspect ratio. Returns whether it changed. */
  private copyCanvasAspect(camera: PerspectiveCamera): boolean {
    const size = this.nativeRenderer.getSize(this.canvasSize);
    const aspect = size.x / size.y;
    if (!(aspect > 0) || !Number.isFinite(aspect) || camera.aspect === aspect) {
      return false;
    }
    camera.aspect = aspect;
    return true;
  }

  /**
   * Sizes the canvas and gives a perspective camera the matching aspect ratio. A view offset
   * (`setViewOffset`: a moved projection centre, a view window) is kept as set, so its offset and
   * window keep their share of the full view; the camera's `aspect`, which is the full view's, is
   * then whatever makes the drawn window as wide as the canvas. Backdrop cameras take both before
   * each draw (`poseBackdropCamera`).
   */
  resizeRenderer(newSize: Point2): void {
    this.nativeRenderer.setSize(newSize.x, newSize.y);
    const camera = this.camera.nativeCamera;
    if (!isPerspective(camera)) {
      return;
    }
    const aspect = aspectForCanvas(camera, newSize.x / newSize.y);
    if (aspect > 0 && Number.isFinite(aspect) && Math.abs(camera.aspect - aspect) > 0.01) {
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
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
        const attached = this.attachedBackdrops.get(backdrop);
        if (!attached?.scene.nativeScene) {
          continue;
        }
        this.poseBackdropCamera(backdrop, attached.camera);
        attached.scene.prepareFrame(renderer, time);
        renderer.render(attached.scene.nativeScene, attached.camera.nativeCamera);
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
