import {
  CubeTextureFaces,
  GgMeta,
  IDisplayObject3dComponentLoader,
  LoadGlbOptions,
  LoadTextureOptions,
  warnOnce,
} from '@gg-web-engine/core';
import {
  CubeTexture,
  CubeTextureLoader,
  EquirectangularReflectionMapping,
  Group,
  Light,
  Object3D,
  SRGBColorSpace,
  Texture,
  TextureLoader,
} from 'three';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { ThreeDisplayObjectComponent } from './components/three-display-object.component';
import { ThreeAnimatedDisplayObjectComponent } from './components/three-animated-display-object.component';
import { ThreeVisualTypeDocRepo } from './types';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class ThreeLoader implements IDisplayObject3dComponentLoader<ThreeVisualTypeDocRepo> {
  private gltfLoader: GLTFLoader = new GLTFLoader();
  private textureLoader: TextureLoader = new TextureLoader();
  private cubeTextureLoader: CubeTextureLoader = new CubeTextureLoader();
  private hdrLoader: HDRLoader = new HDRLoader();

  /**
   * Loads an image texture. A `.hdr` URL is decoded as a linear Radiance HDR image (the usual
   * format for image-based lighting); anything else as an sRGB image.
   */
  public async loadTexture(url: string, options: LoadTextureOptions = {}): Promise<Texture> {
    let texture: Texture;
    if (/\.hdr($|\?)/i.test(url)) {
      texture = await this.hdrLoader.loadAsync(url);
    } else {
      texture = await this.textureLoader.loadAsync(url);
      texture.colorSpace = SRGBColorSpace;
    }
    if (options.mapping === 'equirectangular') {
      texture.mapping = EquirectangularReflectionMapping;
    }
    return texture;
  }

  /**
   * Loads a cube-map sky. three.js lays a cube map out Y-up (its `py` slot is the sky, and the four
   * side images have their top edge towards `+Y`) and samples it with the X axis mirrored. So the
   * engine's Z-up faces go into the slots of the same sky turned a quarter around X - up `pz` into
   * `py`, down `nz` into `ny`, `ny` into `pz` and `py` into `nz` - with `px`/`nx` in each other's
   * slot, and `ThreeSceneComponent` turns the texture back by that quarter when it is used as a
   * background or environment map.
   */
  public async loadCubeTexture(faces: CubeTextureFaces): Promise<CubeTexture> {
    const texture = await this.cubeTextureLoader.loadAsync([
      faces.nx,
      faces.px,
      faces.pz,
      faces.nz,
      faces.ny,
      faces.py,
    ]);
    texture.colorSpace = SRGBColorSpace;
    return texture;
  }

  public disposeTexture(texture: Texture): void {
    texture.dispose();
  }

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
