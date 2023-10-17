import { Gg3dWorld, IRenderer3dComponent, Point2, RendererOptions } from '@gg-web-engine/core';
import { PCFSoftShadowMap, PerspectiveCamera, sRGBEncoding, WebGLRenderer } from 'three';
import { ThreeSceneComponent } from './three-scene.component';
import { ThreeCameraComponent } from './three-camera.component';

export class ThreeRendererComponent extends IRenderer3dComponent<ThreeSceneComponent> {
  public readonly renderer: WebGLRenderer;

  constructor(
    public readonly scene: ThreeSceneComponent,
    public readonly canvas?: HTMLCanvasElement,
    rendererOptions: Partial<RendererOptions> = {},
    public camera: ThreeCameraComponent = new ThreeCameraComponent(new PerspectiveCamera(75, 1, 1, 10000)),
  ) {
    super(scene, canvas, rendererOptions);
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: this.rendererOptions.antialias,
      preserveDrawingBuffer: true,
      alpha: this.rendererOptions.transparent,
    });
    this.renderer.useLegacyLights = false;
    this.renderer.outputEncoding = sRGBEncoding;
    this.renderer.toneMappingExposure = 2;
    this.renderer.shadowMap.enabled = true;
    this.renderer.setClearColor(this.rendererOptions.background);
    this.renderer.shadowMap.type = PCFSoftShadowMap;
    this.renderer.setPixelRatio(this.rendererOptions.forceResolution || devicePixelRatio);
  }

  addToWorld(world: Gg3dWorld<ThreeSceneComponent>) {}

  removeFromWorld(world: Gg3dWorld<ThreeSceneComponent>) {}

  resizeRenderer(newSize: Point2): void {
    this.renderer.setSize(newSize.x, newSize.y);
    if (this.camera.nativeCamera instanceof PerspectiveCamera || this.camera.nativeCamera.type == 'PerspectiveCamera') {
      const newAspect = newSize.x / newSize.y;
      if (Math.abs((this.camera.nativeCamera as PerspectiveCamera).aspect - newAspect) > 0.01) {
        (this.camera.nativeCamera as PerspectiveCamera).aspect = newSize.x / newSize.y;
        (this.camera.nativeCamera as PerspectiveCamera).updateProjectionMatrix();
      }
    }
  }

  render(): void {
    this.renderer.render(this.scene.nativeScene!, this.camera.nativeCamera);
  }

  dispose(): void {
    this.renderer.clear();
    this.renderer.dispose();
    this.renderer.domElement = null as any;
  }
}
