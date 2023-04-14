import { Gg3dRenderer, GgViewport, Point2, RendererOptions } from '@gg-web-engine/core';
import { PCFSoftShadowMap, PerspectiveCamera, sRGBEncoding, WebGLRenderer } from 'three';
import { Gg3dVisualScene } from './gg-3d-visual-scene';
import { ThreeCameraEntity } from './three-camera.entity';
import { ThreeCamera } from './three-camera';

export class GgRenderer extends Gg3dRenderer {
  public readonly renderer: WebGLRenderer;

  constructor(
    public readonly canvas?: HTMLCanvasElement,
    rendererOptions: Partial<RendererOptions> = {},
    public camera: ThreeCameraEntity = new ThreeCameraEntity(new ThreeCamera(new PerspectiveCamera(75, 1, 1, 10000))),
  ) {
    super(canvas, rendererOptions);
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: this.rendererOptions.antialias,
      preserveDrawingBuffer: true,
      alpha: this.rendererOptions.transparent,
    });
    const size = this.rendererOptions.forceRendererSize || GgViewport.instance.getCurrentViewportSize();
    this.renderer.setSize(size.x, size.y);
    this.renderer.useLegacyLights = false;
    this.renderer.outputEncoding = sRGBEncoding;
    this.renderer.toneMappingExposure = 2;
    this.renderer.shadowMap.enabled = true;
    this.renderer.setClearColor(this.rendererOptions.background);
    this.renderer.shadowMap.type = PCFSoftShadowMap;
    this.renderer.setPixelRatio(this.rendererOptions.forceResolution || devicePixelRatio);
  }

  resize(newSize: Point2): void {
    this.renderer.setSize(newSize.x, newSize.y);
    if (
      this.camera.object3D.nativeCamera instanceof PerspectiveCamera ||
      this.camera.object3D.nativeCamera.type == 'PerspectiveCamera'
    ) {
      const newAspect = newSize.x / newSize.y;
      if (Math.abs((this.camera.object3D.nativeCamera as PerspectiveCamera).aspect - newAspect) > 0.01) {
        (this.camera.object3D.nativeCamera as PerspectiveCamera).aspect = newSize.x / newSize.y;
        (this.camera.object3D.nativeCamera as PerspectiveCamera).updateProjectionMatrix();
      }
    }
  }

  render(): void {
    this.renderer.render((this.world!.visualScene as Gg3dVisualScene).nativeScene!, this.camera.object3D.nativeCamera);
  }

  dispose(): void {
    super.dispose();
    if (this.renderer instanceof WebGLRenderer) {
      this.renderer.dispose();
      this.renderer.forceContextLoss();
    }
    this.renderer.domElement = null as any;
  }
}
