import { GgMeta, IGg3dObjectLoader } from '@gg-web-engine/core';
import { Gg3dObject } from './gg-3d-object';
import { Light, Object3D } from 'three';
import { GLTFLoader } from '../three/loaders/GLTFLoader';

export class Gg3dObjectLoader implements IGg3dObjectLoader {
  public async loadFromGgGlb(glbFile: ArrayBuffer, meta: GgMeta): Promise<Gg3dObject | null> {
    const loader: GLTFLoader = new GLTFLoader();
    const gltf = await loader.parseAsync(glbFile, '');
    gltf.scene.traverse((obj: Object3D) => {
      if (obj.type.endsWith('Light')) {
        // TODO determine why it happens and fix in a correct way
        console.warn('WORKAROUND: light intensity from GLB divided by 200.');
        (obj as Light).intensity *= 0.005;
      }
    });
    return new Gg3dObject(gltf.scene);
  }
}
