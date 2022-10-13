import { Gg3dVisualScene } from '@gg-web-engine/core';
import { Scene } from 'three';

export class ThreeVisualScene implements Gg3dVisualScene {

  private _scene: Scene | null = null;
  public get scene(): Scene | null {
    return this._scene;
  }

  async init(): Promise<void> {
    this._scene = new Scene();
  }

  dispose(): void {
    this._scene = new Scene();
  }

}
