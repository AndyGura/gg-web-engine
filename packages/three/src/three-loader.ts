import { GgMeta, IDisplayObject3dComponentLoader } from '@gg-web-engine/core';
import { AnimationClip, Camera, Group, Light, Object3D } from 'three';
import { ThreeDisplayObjectComponent } from './components/three-display-object.component';
import { ThreeVisualTypeDocRepo } from './types';

type GLTF = {
  animations: AnimationClip[];
  scene: Group;
  scenes: Group[];
  cameras: Camera[];
  asset: {
    copyright?: string | undefined;
    generator?: string | undefined;
    version?: string | undefined;
    minVersion?: string | undefined;
    extensions?: any;
    extras?: any;
  };
  parser: any;
  userData: any;
};

export class ThreeLoader implements IDisplayObject3dComponentLoader<ThreeVisualTypeDocRepo> {
  private gltfLoader: {
    parseAsync(data: ArrayBuffer | string, path: string): Promise<GLTF>;
  } | null = null;

  public registerGltfLoaderAddon(gltf: any): void {
    this.gltfLoader = gltf;
  }
  public async loadFromGgGlb(glbFile: ArrayBuffer, meta: GgMeta): Promise<ThreeDisplayObjectComponent | null> {
    if (!this.gltfLoader) {
      throw new Error(
        'Three GLTF loader addon not registered! Use loader.registerGltfLoaderAddon(new GLTFLoader()) before trying to load something',
      );
    }
    const gltf = await this.gltfLoader!.parseAsync(glbFile, '');
    gltf.scene.traverse((obj: Object3D) => {
      if (obj.type.endsWith('Light')) {
        // TODO determine why it happens and fix in a correct way
        console.warn('WORKAROUND: light intensity from GLB divided by 200.');
        (obj as Light).intensity *= 0.005;
      }
    });
    return new ThreeDisplayObjectComponent(gltf.scene);
  }
}
