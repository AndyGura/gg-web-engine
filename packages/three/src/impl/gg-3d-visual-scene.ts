import { IGg3dVisualScene } from '@gg-web-engine/core';
import { Scene } from 'three';

export class Gg3dVisualScene implements IGg3dVisualScene {

  private _nativeScene: Scene | null = null;
  public get nativeScene(): Scene | null {
    return this._nativeScene;
  }

  async init(): Promise<void> {
    this._nativeScene = new Scene();
  }

  dispose(): void {
    this._nativeScene = new Scene();
  }

}
