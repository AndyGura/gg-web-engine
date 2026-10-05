import { BoxGeometry, Mesh, MeshStandardMaterial, Object3D, Scene, Texture, TextureLoader } from 'three';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { ThreeDisplayObjectComponent, ThreeLoader, ThreeSceneComponent } from '../src';

const texturedMesh = () => {
  const map = new Texture();
  const mesh = new Mesh(new BoxGeometry(), new MeshStandardMaterial({ map }));
  return { mesh, map, geometry: mesh.geometry, material: mesh.material as MeshStandardMaterial };
};

describe('ThreeDisplayObjectComponent resource ownership', () => {
  it('a clone shares geometry, materials and textures with its source and frees none of them', () => {
    const { mesh, geometry, material } = texturedMesh();
    const source = new ThreeDisplayObjectComponent(mesh);
    const copy = source.clone();
    expect((copy.nativeMesh as Mesh).geometry).toBe(geometry);
    expect(copy.nativeMesh).not.toBe(mesh);

    const disposeGeometry = jest.spyOn(geometry, 'dispose');
    const disposeMaterial = jest.spyOn(material, 'dispose');
    copy.dispose();
    expect(disposeGeometry).not.toHaveBeenCalled();
    expect(disposeMaterial).not.toHaveBeenCalled();

    source.dispose();
    expect(disposeGeometry).toHaveBeenCalledTimes(1);
    expect(disposeMaterial).toHaveBeenCalledTimes(1);
  });

  it('frees a mesh once, whether it is the root or nested', () => {
    const root = texturedMesh();
    const child = texturedMesh();
    root.mesh.add(child.mesh);
    const rootDispose = jest.spyOn(root.geometry, 'dispose');
    const childDispose = jest.spyOn(child.geometry, 'dispose');
    new ThreeDisplayObjectComponent(root.mesh).dispose();
    expect(rootDispose).toHaveBeenCalledTimes(1);
    expect(childDispose).toHaveBeenCalledTimes(1);
  });

  it('leaves textures to whoever loaded them, except for a loaded model, which owns its own', () => {
    const primitive = texturedMesh();
    const primitiveTexture = jest.spyOn(primitive.map, 'dispose');
    new ThreeDisplayObjectComponent(primitive.mesh).dispose();
    expect(primitiveTexture).not.toHaveBeenCalled();

    const model = texturedMesh();
    const modelTexture = jest.spyOn(model.map, 'dispose');
    const component = new ThreeDisplayObjectComponent(new Object3D().add(model.mesh));
    component.resourceOwnership = 'all';
    // a part split off a model (one per rigid body) owns its share the same way
    model.mesh.name = 'part';
    const part = component.popChild('part')!;
    expect(part.resourceOwnership).toBe('all');
    part.dispose();
    expect(modelTexture).toHaveBeenCalledTimes(1);
  });
});

describe('ThreeLoader', () => {
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;
  let created: string[];
  let revoked: string[];

  beforeEach(() => {
    created = [];
    revoked = [];
    URL.createObjectURL = jest.fn(() => {
      const url = `blob:mock/${created.length}`;
      created.push(url);
      return url;
    });
    URL.revokeObjectURL = jest.fn((url: string) => {
      revoked.push(url);
    });
  });

  afterEach(() => {
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
    jest.restoreAllMocks();
  });

  it('textureFromData decodes the blob through an object url, applies options and revokes the url', async () => {
    const load = jest.spyOn(TextureLoader.prototype, 'loadAsync').mockImplementation(async () => new Texture());
    const texture = await new ThreeLoader().textureFromData(new Blob(['x']), {
      url: 'wall.png',
      repeat: { x: 2, y: 3 },
    });
    expect(load).toHaveBeenCalledWith('blob:mock/0');
    expect(texture.repeat.x).toBe(2);
    expect(texture.colorSpace).toBe('srgb');
    expect(revoked).toEqual(['blob:mock/0']);
  });

  it('textureFromData picks the HDR decoder from the original url, which a blob url does not show', async () => {
    const hdr = jest.spyOn(HDRLoader.prototype, 'loadAsync').mockImplementation(async () => new Texture() as any);
    const plain = jest.spyOn(TextureLoader.prototype, 'loadAsync');
    await new ThreeLoader().textureFromData(new Blob(['x']), { url: 'sky.hdr?v=2', mapping: 'equirectangular' });
    expect(hdr).toHaveBeenCalledWith('blob:mock/0');
    expect(plain).not.toHaveBeenCalled();
  });

  it('revokes the object url when decoding fails', async () => {
    jest.spyOn(TextureLoader.prototype, 'loadAsync').mockRejectedValue(new Error('bad image'));
    await expect(new ThreeLoader().textureFromData(new Blob(['x']), { url: 'a.png' })).rejects.toThrow('bad image');
    expect(revoked).toEqual(['blob:mock/0']);
  });

  it('cubeTextureFromData maps the faces the way loadCubeTexture does', async () => {
    const loader = new ThreeLoader();
    const loadCube = jest.spyOn(loader, 'loadCubeTexture').mockResolvedValue('cube' as any);
    const blob = () => new Blob(['x']);
    await loader.cubeTextureFromData({ px: blob(), nx: blob(), py: blob(), ny: blob(), pz: blob(), nz: blob() });
    expect(loadCube).toHaveBeenCalledWith({
      px: 'blob:mock/0',
      nx: 'blob:mock/1',
      py: 'blob:mock/2',
      ny: 'blob:mock/3',
      pz: 'blob:mock/4',
      nz: 'blob:mock/5',
    });
    expect(revoked).toHaveLength(6);
  });

  describe('prepare', () => {
    const fakeRenderer = () => ({
      nativeRenderer: { initTexture: jest.fn(), compileAsync: jest.fn(async () => {}) },
      camera: { nativeCamera: 'camera' },
    });

    it('does nothing while no renderer draws the scene', async () => {
      const scene = new ThreeSceneComponent();
      await scene.init();
      await expect(scene.loader.prepare(new Texture())).resolves.toBeUndefined();
    });

    it('uploads a texture on every renderer of the scene', async () => {
      const scene = new ThreeSceneComponent();
      await scene.init();
      const a = fakeRenderer();
      const b = fakeRenderer();
      scene.renderers.add(a as any).add(b as any);
      const texture = new Texture();
      await scene.loader.prepare(texture);
      expect(a.nativeRenderer.initTexture).toHaveBeenCalledWith(texture);
      expect(b.nativeRenderer.initTexture).toHaveBeenCalledWith(texture);
    });

    it("compiles a model against the scene and uploads its materials' textures", async () => {
      const scene = new ThreeSceneComponent();
      await scene.init();
      const renderer = fakeRenderer();
      scene.renderers.add(renderer as any);
      const { mesh, map } = texturedMesh();
      const root = new Object3D().add(mesh);
      await scene.loader.prepare(new ThreeDisplayObjectComponent(root));
      expect(renderer.nativeRenderer.initTexture).toHaveBeenCalledWith(map);
      expect(renderer.nativeRenderer.compileAsync).toHaveBeenCalledWith(root, 'camera', expect.any(Scene));
    });
  });
});
