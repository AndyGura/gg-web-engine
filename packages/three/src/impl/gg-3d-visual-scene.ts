import { IGg3dVisualScene } from '@gg-web-engine/core';
import { Scene } from 'three';
import { Gg3dObjectFactory } from './gg-3d-object-factory';
import { Gg3dObjectLoader } from './gg-3d-object-loader';
import { ThreePhysicsDrawer } from '../three-physics-drawer';

export class Gg3dVisualScene implements IGg3dVisualScene {

  private _nativeScene: Scene | null = null;
  public get nativeScene(): Scene | null {
    return this._nativeScene;
  }

  public readonly factory: Gg3dObjectFactory = new Gg3dObjectFactory();
  public readonly loader: Gg3dObjectLoader = new Gg3dObjectLoader();

  public readonly debugPhysicsDrawerClass = ThreePhysicsDrawer;

  async init(): Promise<void> {
    this._nativeScene = new Scene();
  }

  dispose(): void {
    this._nativeScene = new Scene();
  }

}
