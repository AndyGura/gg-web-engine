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
  Group,
  Light,
  Mesh,
  Object3D,
  SRGBColorSpace,
  Texture,
  TextureLoader,
} from 'three';
import type { ThreeSceneComponent } from './components/three-scene.component';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { materialTextures, ThreeDisplayObjectComponent } from './components/three-display-object.component';
import { ThreeAnimatedDisplayObjectComponent } from './components/three-animated-display-object.component';
import { ThreeVisualTypeDocRepo } from './types';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { applyTextureOptions } from './utils/texture-options';

/** A loaded model's textures came with its file: it frees them along with its meshes. */
function ownedByModel<T extends ThreeDisplayObjectComponent>(component: T): T {
  component.resourceOwnership = 'all';
  return component;
}

/** Runs `load` with a temporary object url for `data`, the form three's loaders take a file in. */
async function withObjectUrl<T>(data: Blob[], load: (urls: string[]) => Promise<T>): Promise<T> {
  const urls = data.map(blob => URL.createObjectURL(blob));
  try {
    return await load(urls);
  } finally {
    urls.forEach(url => URL.revokeObjectURL(url));
  }
}

export class ThreeLoader implements IDisplayObject3dComponentLoader<ThreeVisualTypeDocRepo> {
  /**
   * @param scene - The scene this loader belongs to; `prepare` uploads to its renderers. Without
   * one, `prepare` does nothing.
   */
  constructor(private readonly scene?: ThreeSceneComponent) {}

  private gltfLoader: GLTFLoader = new GLTFLoader();
  private textureLoader: TextureLoader = new TextureLoader();
  private cubeTextureLoader: CubeTextureLoader = new CubeTextureLoader();
  private hdrLoader: HDRLoader = new HDRLoader();

  /**
   * Loads an image texture. A `.hdr` URL is decoded as a linear Radiance HDR image (the usual
   * format for image-based lighting); anything else as an sRGB image.
   */
  public async loadTexture(url: string, options: LoadTextureOptions = {}): Promise<Texture> {
    return this.decodeTexture(url, url, options);
  }

  /** Decodes `data` like `loadTexture` decodes its url; `options.url` tells a `.hdr` file apart. */
  public async textureFromData(data: Blob, options: LoadTextureOptions & { url?: string } = {}): Promise<Texture> {
    const { url, ...textureOptions } = options;
    return withObjectUrl([data], ([objectUrl]) => this.decodeTexture(objectUrl, url ?? '', textureOptions));
  }

  private async decodeTexture(source: string, name: string, options: LoadTextureOptions): Promise<Texture> {
    let texture: Texture;
    if (/\.hdr($|\?)/i.test(name)) {
      texture = await this.hdrLoader.loadAsync(source);
    } else {
      texture = await this.textureLoader.loadAsync(source);
      texture.colorSpace = SRGBColorSpace;
    }
    return applyTextureOptions(texture, options);
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

  /** `loadCubeTexture` for faces that are already fetched. */
  public async cubeTextureFromData(faces: Record<keyof CubeTextureFaces, Blob>): Promise<CubeTexture> {
    return withObjectUrl([faces.px, faces.nx, faces.py, faces.ny, faces.pz, faces.nz], ([px, nx, py, ny, pz, nz]) =>
      this.loadCubeTexture({ px, nx, py, ny, pz, nz }),
    );
  }

  /**
   * Uploads a texture, or compiles the shaders and uploads the textures of a model, on every
   * renderer drawing the scene - the work three.js otherwise does on the first frame the resource
   * is visible in. With no renderer added to the world yet there is nothing to upload to.
   */
  public async prepare(resource: Texture | ThreeDisplayObjectComponent): Promise<void> {
    const scene = this.scene;
    if (!scene || !scene.nativeScene) {
      return;
    }
    for (const renderer of scene.renderers) {
      const native = renderer.nativeRenderer;
      if (resource instanceof Texture) {
        native.initTexture(resource);
        continue;
      }
      resource.nativeMesh.traverse(obj => {
        const material = (obj as Mesh).material;
        for (const m of material ? (Array.isArray(material) ? material : [material]) : []) {
          materialTextures(m).forEach(texture => native.initTexture(texture));
        }
      });
      await native.compileAsync(resource.nativeMesh, renderer.camera.nativeCamera, scene.nativeScene);
    }
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
    return ownedByModel(new ThreeDisplayObjectComponent(gltf.scene));
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
      return ownedByModel(new ThreeAnimatedDisplayObjectComponent(root, gltf.animations));
    }
    return ownedByModel(new ThreeDisplayObjectComponent(root));
  }
}
