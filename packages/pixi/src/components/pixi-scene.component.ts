import { IVisualScene2dComponent, RendererOptions } from '@gg-web-engine/core';
import { ApplicationOptions, Container } from 'pixi.js';
import { PixiFactory } from '../pixi-factory';
import { PixiCameraComponent } from './pixi-camera.component';
import { PixiRendererComponent } from './pixi-renderer.component';
import { PixiVisualTypeDocRepo2D } from '../types';

export class PixiSceneComponent implements IVisualScene2dComponent<PixiVisualTypeDocRepo2D> {
  private _nativeContainer: Container | null = null;
  public get nativeContainer(): Container | null {
    return this._nativeContainer;
  }

  public readonly factory: PixiFactory = new PixiFactory();

  constructor() {}

  async init(): Promise<void> {
    this._nativeContainer = new Container();
  }

  createRenderer(
    camera: PixiCameraComponent,
    canvas?: HTMLCanvasElement,
    rendererOptions?: Partial<RendererOptions & ApplicationOptions>,
  ): PixiRendererComponent {
    return new PixiRendererComponent(this, camera, canvas, rendererOptions);
  }

  dispose(): void {
    this._nativeContainer?.destroy();
    this._nativeContainer = null;
  }
}
