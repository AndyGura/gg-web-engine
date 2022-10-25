import { IGg3dVisualScene } from '@gg-web-engine/core';
import { Container } from 'pixi.js';

export class Gg2dVisualScene implements IGg3dVisualScene {

  private _nativeContainer: Container | null = null;
  public get nativeContainer(): Container | null {
    return this._nativeContainer;
  }

  async init(): Promise<void> {
    this._nativeContainer = new Container();
  }

  dispose(): void {
    this._nativeContainer?.destroy();
    this._nativeContainer = null;
  }

}
