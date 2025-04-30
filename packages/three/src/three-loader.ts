import { GgMeta, IDisplayObject3dComponentLoader } from '@gg-web-engine/core';
import { Light, Object3D } from 'three';
import { ThreeDisplayObjectComponent } from './components/three-display-object.component';
import { ThreeVisualTypeDocRepo } from './types';
import { GLTFLoader } from './three-examples/loaders/GLTFLoader';

export class ThreeLoader implements IDisplayObject3dComponentLoader<ThreeVisualTypeDocRepo> {
  private gltfLoader: GLTFLoader = new GLTFLoader();

  public async loadFromGgGlb(glbFile: ArrayBuffer, meta: GgMeta): Promise<ThreeDisplayObjectComponent | null> {
    const gltf = await this.gltfLoader.parseAsync(glbFile, '');
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
