import { IVisualScene3dComponent, RendererOptions } from '@gg-web-engine/core';
import { Scene, WebGLRendererParameters } from 'three';
import { ThreeFactory } from '../three-factory';
import { ThreeLoader } from '../three-loader';
import { ThreeCameraComponent } from './three-camera.component';
import { ThreeRendererComponent } from './three-renderer.component';
import { ThreeVisualTypeDocRepo } from '../types';
import { ThreeComposerRendererComponent } from './three-composer-renderer.component';

export class ThreeSceneComponent implements IVisualScene3dComponent<ThreeVisualTypeDocRepo> {
  private _nativeScene: Scene | null = null;
  public get nativeScene(): Scene | null {
    return this._nativeScene;
  }

  public readonly factory: ThreeFactory = new ThreeFactory();
  public readonly loader: ThreeLoader = new ThreeLoader();

  async init(): Promise<void> {
    this._nativeScene = new Scene();
  }

  createRenderer(
    camera: ThreeCameraComponent,
    canvas?: HTMLCanvasElement,
    rendererOptions?: Partial<RendererOptions & WebGLRendererParameters>,
  ): ThreeRendererComponent {
    return new ThreeRendererComponent(this, camera, canvas, rendererOptions);
  }

  createComposerRenderer(
    camera: ThreeCameraComponent,
    canvas?: HTMLCanvasElement,
    rendererOptions?: Partial<RendererOptions & WebGLRendererParameters>,
  ): ThreeComposerRendererComponent {
    return new ThreeComposerRendererComponent(this, camera, canvas, rendererOptions);
  }

  dispose(): void {
    this._nativeScene = new Scene();
  }
}
