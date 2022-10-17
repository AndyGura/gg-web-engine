import { GgRenderer } from '@gg-web-engine/core';
import { Camera, PerspectiveCamera, Renderer, WebGLRenderer } from 'three';
import { ThreeVisualScene } from './three-visual-scene';

export class ThreeCameraRenderer extends GgRenderer {

  constructor(
    protected readonly scene: ThreeVisualScene,
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
