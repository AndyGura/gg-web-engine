import { Gg3dVisualScene } from '@gg-web-engine/core';
import { Scene } from 'three';

export class ThreeVisualScene implements Gg3dVisualScene {

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
