import { Gg3dWorld, PhysicsTypeDocRepo3D, Point2, RendererOptions } from '@gg-web-engine/core';
import { WebGLRendererParameters } from 'three';
import { ThreeSceneComponent } from './three-scene.component';
import { ThreeCameraComponent } from './three-camera.component';
import { ThreeVisualTypeDocRepo } from '../types';
import { EffectComposer } from 'three-examples/postprocessing/EffectComposer';
import { ThreeRendererComponent } from './three-renderer.component';
import { RenderPass } from 'three-examples/postprocessing/RenderPass';

export class ThreeComposerRendererComponent extends ThreeRendererComponent {
  public readonly nativeComposer: EffectComposer;

  constructor(
    scene: ThreeSceneComponent,
    camera: ThreeCameraComponent,
    canvas?: HTMLCanvasElement,
    rendererOptions: Partial<RendererOptions & WebGLRendererParameters> = {},
  ) {
    super(scene, camera, canvas, rendererOptions);
    this.nativeComposer = new EffectComposer(this.nativeRenderer);
  }

  addToWorld(world: Gg3dWorld<ThreeVisualTypeDocRepo, PhysicsTypeDocRepo3D, ThreeSceneComponent>) {
    super.addToWorld(world);
    const renderPass = new RenderPass(this.scene.nativeScene!, this.camera.nativeCamera);
    this.nativeComposer.insertPass(renderPass, 0);
  }

  resizeRenderer(newSize: Point2): void {
    super.resizeRenderer(newSize);
    this.nativeComposer.setSize(newSize.x, newSize.y);
  }

  render(): void {
    this.nativeComposer.render();
    if (this.physicsDebugViewActive) {
      this.debugView!.render(this.nativeRenderer, this.camera.nativeCamera);
    }
  }

  dispose(): void {
    super.dispose();
    this.nativeComposer.dispose();
  }
}
