import { Gg3dWorld, IRenderer3dComponent, Point2, RendererOptions } from '@gg-web-engine/core';
import { PCFSoftShadowMap, PerspectiveCamera, sRGBEncoding, WebGLRenderer } from 'three';
import { ThreeSceneComponent } from './three-scene.component';
import { ThreeCameraComponent } from './three-camera.component';

export class ThreeRendererComponent extends IRenderer3dComponent<ThreeSceneComponent, ThreeCameraComponent> {
  public readonly nativeRenderer: WebGLRenderer;

  constructor(
    public readonly scene: ThreeSceneComponent,
    public readonly canvas?: HTMLCanvasElement,
    rendererOptions: Partial<RendererOptions> = {},
    public camera: ThreeCameraComponent = new ThreeCameraComponent(new PerspectiveCamera(75, 1, 1, 10000)),
  ) {
    super(scene, canvas, rendererOptions);
    this.nativeRenderer = new WebGLRenderer({
      canvas,
      antialias: this.rendererOptions.antialias,
      preserveDrawingBuffer: true,
      alpha: this.rendererOptions.transparent,
    });
    this.nativeRenderer.useLegacyLights = false;
    this.nativeRenderer.outputEncoding = sRGBEncoding;
    this.nativeRenderer.toneMappingExposure = 2;
    this.nativeRenderer.shadowMap.enabled = true;
    this.nativeRenderer.setClearColor(this.rendererOptions.background);
    this.nativeRenderer.shadowMap.type = PCFSoftShadowMap;
    this.nativeRenderer.setPixelRatio(this.rendererOptions.forceResolution || devicePixelRatio);
  }

  addToWorld(world: Gg3dWorld<ThreeSceneComponent>) {}

  removeFromWorld(world: Gg3dWorld<ThreeSceneComponent>) {}

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
  }

  dispose(): void {
    this.camera.dispose();
    this.nativeRenderer.clear();
    this.nativeRenderer.dispose();
    this.nativeRenderer.domElement = null as any;
  }
}
