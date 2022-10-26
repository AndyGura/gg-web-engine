import { IGg2dVisualScene } from '@gg-web-engine/core';
import { Container } from 'pixi.js';
import { Gg2dObjectFactory } from './gg-2d-object-factory';

export class Gg2dVisualScene implements IGg2dVisualScene {

  private _nativeContainer: Container | null = null;
  public get nativeContainer(): Container | null {
    return this._nativeContainer;
  }

  public readonly factory: Gg2dObjectFactory = new Gg2dObjectFactory();

  async init(): Promise<void> {
    this._nativeContainer = new Container();
  }

  dispose(): void {
    this._nativeContainer?.destroy();
    this._nativeContainer = null;
  }

}
