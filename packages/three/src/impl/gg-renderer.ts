import { BaseGgRenderer } from '@gg-web-engine/core';
import { Camera, PerspectiveCamera, Renderer, WebGLRenderer } from 'three';
import { Gg3dVisualScene } from './gg-3d-visual-scene';

export class GgRenderer extends BaseGgRenderer {

  constructor(
    protected readonly scene: Gg3dVisualScene,
    public readonly renderer: Renderer,
    public nativeCamera: Camera = new PerspectiveCamera(75, 1, 1, 10000),
  ) {
    super(scene);
    scene.nativeScene?.add(nativeCamera);
  }

  render(): void {
    this.renderer.render(this.scene.nativeScene!, this.nativeCamera);
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
