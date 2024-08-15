import { Gg3dWorld, IRenderer3dComponent, PhysicsTypeDocRepo3D, Point2, RendererOptions } from '@gg-web-engine/core';
import { PCFSoftShadowMap, PerspectiveCamera, WebGLRenderer, WebGLRendererParameters } from 'three';
import { ThreeSceneComponent } from './three-scene.component';
import { ThreeCameraComponent } from './three-camera.component';
import { ThreeVisualTypeDocRepo } from '../types';
import { ThreePhysicsDebugView } from './three-physics-debug-view';

export class ThreeRendererComponent extends IRenderer3dComponent<ThreeVisualTypeDocRepo> {
  public readonly nativeRenderer: WebGLRenderer;
  protected world: Gg3dWorld<ThreeVisualTypeDocRepo, PhysicsTypeDocRepo3D, ThreeSceneComponent> | null = null;

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

  addToWorld(world: Gg3dWorld<ThreeVisualTypeDocRepo, PhysicsTypeDocRepo3D, ThreeSceneComponent>) {
    this.world = world;
    if (this.physicsDebugViewActive) {
      this.debugView = ThreePhysicsDebugView.startDebugView(this.world, this);
    }
  }

  removeFromWorld(world: Gg3dWorld<ThreeVisualTypeDocRepo, PhysicsTypeDocRepo3D, ThreeSceneComponent>) {
    if (this.physicsDebugViewActive) {
      ThreePhysicsDebugView.stopDebugView(this.debugView!, this);
      this.debugView = null;
    }
    this.world = null;
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

  dispose(): void {
    this.camera.dispose();
    this.nativeRenderer.clear();
    this.nativeRenderer.dispose();
    this.nativeRenderer.domElement = null as any;
  }
}
