import { GgMeta, IGg3dObjectLoader } from '@gg-web-engine/core';
import { Gg3dObject } from './gg-3d-object';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

export class Gg3dObjectLoader implements IGg3dObjectLoader {
  public async loadFromGgGlb(glbFile: ArrayBuffer, meta: GgMeta): Promise<Gg3dObject | null> {
    const loader: GLTFLoader = new GLTFLoader();
    const gltf = await loader.parseAsync(glbFile, '');
    return new Gg3dObject(gltf.scene);
  }
}
