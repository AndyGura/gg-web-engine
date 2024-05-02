import { IVisualScene3dComponent, RendererOptions } from '@gg-web-engine/core';
import { Color, Fog, MeshBasicMaterial, Scene } from 'three';
import { ThreeFactory } from '../three-factory';
import { ThreeLoader } from '../three-loader';
import { ThreeCameraComponent } from './three-camera.component';
import { ThreeRendererComponent } from './three-renderer-component';
import { ThreeVisualTypeDocRepo } from '../types';

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
    rendererOptions?: Partial<RendererOptions>,
  ): ThreeRendererComponent {
    return new ThreeRendererComponent(this, camera, canvas, rendererOptions);
  }

  dispose(): void {
    this._nativeScene = new Scene();
  }

  private _renderWireframe: boolean = false;
  get renderWireframe(): boolean {
    return this._renderWireframe;
  }

  set renderWireframe(value: boolean) {
    this._renderWireframe = value;
    if (value) {
      const mat = new MeshBasicMaterial();
      mat.wireframe = true;
      mat.color = new Color(0xff, 0, 0);
      mat.wireframeLinewidth = 1;
      this.nativeScene!.overrideMaterial = mat;
      this.nativeScene!.fog = new Fog(0x000000, 100, 1000);
    } else {
      this.nativeScene!.overrideMaterial = null;
    }
  }
}
