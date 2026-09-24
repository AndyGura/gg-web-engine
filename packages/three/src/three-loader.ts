import { GgMeta, IDisplayObject3dComponentLoader, LoadGlbOptions, warnOnce } from '@gg-web-engine/core';
import { Group, Light, Object3D } from 'three';
import { ThreeDisplayObjectComponent } from './components/three-display-object.component';
import { ThreeAnimatedDisplayObjectComponent } from './components/three-animated-display-object.component';
import { ThreeVisualTypeDocRepo } from './types';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class ThreeLoader implements IDisplayObject3dComponentLoader<ThreeVisualTypeDocRepo> {
  private gltfLoader: GLTFLoader = new GLTFLoader();

  public async loadFromGgGlb(glbFile: ArrayBuffer, meta: GgMeta): Promise<ThreeDisplayObjectComponent | null> {
    const gltf = await this.gltfLoader.parseAsync(glbFile, '');
    gltf.scene.traverse((obj: Object3D) => {
      if (obj.type.endsWith('Light')) {
        // TODO determine why it happens and fix in a correct way
        warnOnce('WORKAROUND: light intensity from GLB divided by 200.');
        (obj as Light).intensity *= 0.005;
      }
    });
    return new ThreeDisplayObjectComponent(gltf.scene);
  }

  public async loadFromGlb(
    glbFile: ArrayBuffer,
    options: LoadGlbOptions = {},
  ): Promise<ThreeDisplayObjectComponent | null> {
    const gltf = await this.gltfLoader.parseAsync(glbFile, '');
    gltf.scene.traverse((obj: Object3D) => {
      if (obj.type.endsWith('Light')) {
        warnOnce('WORKAROUND: light intensity from GLB divided by 200.');
        (obj as Light).intensity *= 0.005;
      }
    });
    // The offset is applied to `gltf.scene` itself, then a `Group` wraps it, rather than applying
    // the offset directly to whatever `nativeMesh` this method returns - the returned display
    // object's own `position` is overwritten wholesale every tick by whatever drives it (e.g.
    // `CharacterController3dEntity.position`'s setter), which would clobber a same-node offset
    // immediately; nesting it one level down under an untouched wrapper node is what makes the
    // offset survive that.
    let root: Object3D = gltf.scene;
    if (options.offset) {
      const group = new Group();
      gltf.scene.position.set(options.offset.x, options.offset.y, options.offset.z);
      group.add(gltf.scene);
      root = group;
    }
    if (gltf.animations.length > 0) {
      return new ThreeAnimatedDisplayObjectComponent(root, gltf.animations);
    }
    return new ThreeDisplayObjectComponent(root);
  }
}
