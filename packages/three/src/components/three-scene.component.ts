import { IVisualScene3dComponent, RendererOptions } from '@gg-web-engine/core';
import { Scene } from 'three';
import { ThreeFactory } from '../three-factory';
import { ThreeLoader } from '../three-loader';
import { ThreePhysicsDrawer } from '../three-physics-drawer';
import { ThreeCameraComponent } from './three-camera.component';
import { ThreeRendererComponent } from './three-renderer-component';

export class ThreeSceneComponent implements IVisualScene3dComponent {
  private _nativeScene: Scene | null = null;
  public get nativeScene(): Scene | null {
    return this._nativeScene;
  }

  public readonly factory: ThreeFactory = new ThreeFactory();
  public readonly loader: ThreeLoader = new ThreeLoader();

  public readonly debugPhysicsDrawerClass = ThreePhysicsDrawer;

  async init(): Promise<void> {
    this._nativeScene = new Scene();
  }

  createRenderer(
    camera: ThreeCameraComponent,
    canvas?: HTMLCanvasElement,
    rendererOptions?: Partial<RendererOptions>,
  ): ThreeRendererComponent {
    return new ThreeRendererComponent(this, canvas, rendererOptions, camera);
  }

  dispose(): void {
    this._nativeScene = new Scene();
  }
}