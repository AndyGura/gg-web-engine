import { IRenderer3dComponent, Point2, RendererOptions } from '@gg-web-engine/core';
import { PCFSoftShadowMap, PerspectiveCamera, WebGLRenderer, WebGLRendererParameters } from 'three';
import { ThreeSceneComponent } from './three-scene.component';
import { ThreeCameraComponent } from './three-camera.component';
import { ThreeGgWorld, ThreeVisualTypeDocRepo } from '../types';
import { ThreePhysicsDebugView } from './three-physics-debug-view';

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
    rendererOptions: Partial<RendererOptions & WebGLRendererParameters> = {},
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
    this.nativeRenderer.setPixelRatio(this.rendererOptions.forceResolution || devicePixelRatio);
  }

  addToWorld(world: ThreeGgWorld) {
    this.world = world;
    this.scene.renderers.add(this);
    if (this.physicsDebugViewActive) {
      this.debugView = ThreePhysicsDebugView.startDebugView(this.world, this);
    }
  }

  removeFromWorld(world: ThreeGgWorld, dispose?: boolean) {
    if (this.physicsDebugViewActive) {
      ThreePhysicsDebugView.stopDebugView(this.debugView!, this);
      this.debugView = null;
    }
    this.world = null;
    this.scene.renderers.delete(this);
    if (dispose) {
      this.dispose();
    }
  }

  resizeRenderer(newSize: Point2): void {
    this.nativeRenderer.setSize(newSize.x, newSize.y);
    if (this.camera.nativeCamera instanceof PerspectiveCamera || this.camera.nativeCamera.type == 'PerspectiveCamera') {
      const newAspect = newSize.x / newSize.y;
      if (Math.abs((this.camera.nativeCamera as PerspectiveCamera).aspect - newAspect) > 0.01) {
        (this.camera.nativeCamera as PerspectiveCamera).aspect = newSize.x / newSize.y;
        (this.camera.nativeCamera as PerspectiveCamera).updateProjectionMatrix();
      }
    }
  }

  render(): void {
    this.nativeRenderer.render(this.scene.nativeScene!, this.camera.nativeCamera);
    if (this.physicsDebugViewActive) {
      this.debugView!.render(this.nativeRenderer, this.camera.nativeCamera);
    }
  }

  /**
   * Frees the renderer and gives its WebGL context back to the browser right away, instead of
   * leaving that to garbage collection - a page gets only so many contexts (about 16), and an app
   * that creates a world per game session would run out. The canvas can't be used for another
   * renderer afterwards: create a new canvas for the next one.
   */
  dispose(): void {
    this.scene.renderers.delete(this);
    this.camera.dispose();
    this.nativeRenderer.clear();
    this.nativeRenderer.dispose();
    this.nativeRenderer.forceContextLoss();
    this.nativeRenderer.domElement = null as any;
  }
}
