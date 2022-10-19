import { BaseGgRenderer, Gg3dWorld, GgViewport, Point2, RendererOptions } from '@gg-web-engine/core';
import { Camera, PCFSoftShadowMap, PerspectiveCamera, sRGBEncoding, WebGLRenderer } from 'three';
import { Gg3dVisualScene } from './gg-3d-visual-scene';

export class GgRenderer extends BaseGgRenderer {

  public readonly renderer: WebGLRenderer;

  constructor(
    canvas?: HTMLCanvasElement,
    rendererOptions: Partial<RendererOptions> = {},
    public nativeCamera: Camera = new PerspectiveCamera(75, 1, 1, 10000),
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
    this.renderer.physicallyCorrectLights = true;
    this.renderer.outputEncoding = sRGBEncoding;
    this.renderer.toneMappingExposure = 2;
    this.renderer.shadowMap.enabled = true;
    this.renderer.setClearColor(this.rendererOptions.background);
    this.renderer.shadowMap.type = PCFSoftShadowMap;
    this.renderer.setPixelRatio(this.rendererOptions.forceResolution || devicePixelRatio);
  }

  onSpawned(world: Gg3dWorld): void {
    super.onSpawned(world);
    (world.visualScene as Gg3dVisualScene).nativeScene?.add(this.nativeCamera);
  };

  onRemoved(): void {
    (this.world!.visualScene as Gg3dVisualScene).nativeScene?.remove(this.nativeCamera);
    super.onRemoved();
  }

  resize(newSize: Point2): void {
    this.renderer.setSize(newSize.x, newSize.y);
    if (this.nativeCamera instanceof PerspectiveCamera) {
      const newAspect = newSize.x / newSize.y;
      if (Math.abs(this.nativeCamera.aspect - newAspect) > 0.01) {
        this.nativeCamera.aspect = newSize.x / newSize.y;
        this.nativeCamera.updateProjectionMatrix();
      }
    }
  }

  render(): void {
    this.renderer.render((this.world!.visualScene as Gg3dVisualScene).nativeScene!, this.nativeCamera);
  }

  dispose(): void {
    this.nativeCamera?.removeFromParent();
    if (this.renderer instanceof WebGLRenderer) {
      this.renderer.dispose();
      this.renderer.forceContextLoss();
    }
    this.renderer.domElement = null as any;
  }

}
