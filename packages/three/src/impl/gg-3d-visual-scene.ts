import { IGg3dVisualScene } from '@gg-web-engine/core';
import { Scene } from 'three';
import { Gg3dObjectFactory } from './gg-3d-object-factory';

export class Gg3dVisualScene implements IGg3dVisualScene {

  private _nativeScene: Scene | null = null;
  public get nativeScene(): Scene | null {
    return this._nativeScene;
  }

  public readonly factory: Gg3dObjectFactory = new Gg3dObjectFactory();

  async init(): Promise<void> {
    this._nativeScene = new Scene();
  }

  dispose(): void {
    this._nativeScene = new Scene();
  }

}
