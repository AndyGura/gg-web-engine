import {
  IVisualScene3dComponent,
  MAIN_RENDER_LAYER,
  RenderLayer,
  RendererOptions,
  SELF_VIEW_HIDDEN_RENDER_LAYER,
} from '@gg-web-engine/core';
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

  public readonly mainRenderLayer: RenderLayer = MAIN_RENDER_LAYER;

  async init(): Promise<void> {
    this._nativeScene = new Scene();
  }

  // Mirrors `AmmoWorldComponent.lockedCollisionGroups`/`registerCollisionGroup` exactly - see that
  // method's own doc. Three.js layers only go up to index 31 (a 32-bit mask); `31` itself
  // (`SELF_VIEW_HIDDEN_RENDER_LAYER`) is permanently excluded from this range rather than tracked in
  // `lockedRenderLayers` - it's reserved engine-wide, not something this one scene instance could
  // ever "free" by deregistering it.
  protected lockedRenderLayers: RenderLayer[] = [];

  registerRenderLayer(): RenderLayer {
    for (let i = 1; i < SELF_VIEW_HIDDEN_RENDER_LAYER; i++) {
      if (!this.lockedRenderLayers.includes(i)) {
        this.lockedRenderLayers.push(i);
        return i;
      }
    }
    throw new Error(
      `App tries to register too many render layers, three.js supports only ${SELF_VIEW_HIDDEN_RENDER_LAYER - 1}`,
    );
  }

  deregisterRenderLayer(layer: RenderLayer): void {
    this.lockedRenderLayers = this.lockedRenderLayers.filter(x => x !== layer);
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
