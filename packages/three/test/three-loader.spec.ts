import {
  BoxGeometry,
  CubeTexture,
  CubeTextureLoader,
  LinearFilter,
  Mesh,
  MeshStandardMaterial,
  NearestFilter,
  Object3D,
  Scene,
  Texture,
  TextureLoader,
} from 'three';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { readFileSync } from 'fs';
import { join } from 'path';
import { lazyMeshoptDecoder, ThreeDisplayObjectComponent, ThreeLoader, ThreeSceneComponent } from '../src';

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
    expect(loadCube).toHaveBeenCalledWith(
      {
        px: 'blob:mock/0',
        nx: 'blob:mock/1',
        py: 'blob:mock/2',
        ny: 'blob:mock/3',
        pz: 'blob:mock/4',
        nz: 'blob:mock/5',
      },
      {},
    );
    expect(revoked).toHaveLength(6);
  });

  it('loadCubeTexture applies the filter the way loadTexture does, through the data path too', async () => {
    jest.spyOn(CubeTextureLoader.prototype, 'loadAsync').mockImplementation(async () => new CubeTexture());
    const loader = new ThreeLoader();
    const faces = { px: 'px', nx: 'nx', py: 'py', ny: 'ny', pz: 'pz', nz: 'nz' };
    const nearest = await loader.loadCubeTexture(faces, { filter: 'nearest' });
    expect(nearest.magFilter).toBe(NearestFilter);
    expect(nearest.minFilter).toBe(NearestFilter);
    expect(nearest.colorSpace).toBe('srgb');
    const linear = await loader.loadCubeTexture(faces, { filter: 'linear' });
    expect(linear.magFilter).toBe(LinearFilter);
    const blob = () => new Blob(['x']);
    const fromData = await loader.cubeTextureFromData(
      { px: blob(), nx: blob(), py: blob(), ny: blob(), pz: blob(), nz: blob() },
      { filter: 'nearest' },
    );
    expect(fromData.magFilter).toBe(NearestFilter);
    expect(fromData.minFilter).toBe(NearestFilter);
  });

  describe('meshopt-compressed GLB', () => {
    // fixtures/meshopt-quad.glb, written by fixtures/meshopt-quad.mjs: a quad of 16-bit integer
    // positions (KHR_mesh_quantization) whose buffers are EXT_meshopt_compression streams, both required
    const positions = [
      [-100, -50, 0],
      [100, -50, 0],
      [100, 50, 25],
      [-100, 50, 25],
    ];
    // copied into an ArrayBuffer of the test's own realm: GLTFLoader tells a .glb by `instanceof
    // ArrayBuffer`, which a Node Buffer's backing store (another realm under jsdom) fails
    const glb = (): ArrayBuffer => {
      const file = readFileSync(join(__dirname, 'fixtures', 'meshopt-quad.glb'));
      const data = new ArrayBuffer(file.byteLength);
      new Uint8Array(data).set(file);
      return data;
    };
    // `isMesh`, not `instanceof`: the isolated copies below load a three.js of their own
    const quadOf = (component: { nativeMesh: Object3D } | null): Mesh => {
      const quad = component!.nativeMesh.getObjectByName('quad') as Mesh;
      expect(quad?.isMesh).toBe(true);
      return quad;
    };
    const expectDecoded = (quad: Mesh) => {
      const position = quad.geometry.getAttribute('position');
      expect(position.count).toBe(positions.length);
      positions.forEach(([x, y, z], i) => {
        expect([position.getX(i), position.getY(i), position.getZ(i)]).toEqual([x, y, z]);
      });
      expect(Array.from(quad.geometry.index!.array)).toEqual([0, 1, 2, 0, 2, 3]);
      expect(quad.scale.x).toBeCloseTo(0.01);
    };

    it('the fixture needs a meshopt decoder: three.js refuses it without one', async () => {
      await expect(new GLTFLoader().parseAsync(glb(), '')).rejects.toThrow('setMeshoptDecoder');
    });

    it('loadFromGlb decodes it', async () => {
      expectDecoded(quadOf(await new ThreeLoader().loadFromGlb(glb())));
    });

    it('loadFromGgGlb decodes it', async () => {
      expectDecoded(quadOf(await new ThreeLoader().loadFromGgGlb(glb(), { entities: [] } as any)));
    });

    it("a GLTFLoader of the app's own decodes it with lazyMeshoptDecoder", async () => {
      const gltf = await new GLTFLoader().setMeshoptDecoder(lazyMeshoptDecoder).parseAsync(glb(), '');
      expectDecoded(quadOf({ nativeMesh: gltf.scene }));
    });

    describe('lazyMeshoptDecoder', () => {
      const MESHOPT_MODULE = 'three/examples/jsm/libs/meshopt_decoder.module.js';

      afterEach(() => {
        jest.dontMock(MESHOPT_MODULE);
        jest.useRealTimers();
      });

      /**
       * A fresh copy of the package (the decoder is module state) whose meshopt module is a
       * stand-in: three's real decoder on the main thread, with `useWorkers` recorded and workers
       * that answer, or never do. `resetModules`, not `isolateModulesAsync`: the decoder's
       * `import()` runs at the first decode, after an isolation callback would have returned, so it
       * resolves through the shared registry, whose cached stand-in has to be a fresh one.
       */
      const isolated = async (workersAnswer = true) => {
        const real = jest.requireActual(MESHOPT_MODULE).MeshoptDecoder;
        let workers = 0;
        const fake = {
          supported: true,
          ready: real.ready,
          useWorkers: jest.fn((count: number) => {
            workers = count;
          }),
          decodeGltfBuffer: jest.fn(),
          decodeGltfBufferAsync: jest.fn((...args: any[]) =>
            workers > 0 && !workersAnswer ? new Promise(() => {}) : real.decodeGltfBufferAsync(...args),
          ),
        };
        const evaluated = jest.fn(() => ({ MeshoptDecoder: fake }));
        jest.resetModules();
        jest.doMock(MESHOPT_MODULE, evaluated);
        const src: typeof import('../src') = await import('../src');
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
        return { src, fake, evaluated, warn };
      };
      const probe = [0, 4, new Uint8Array(0), 'ATTRIBUTES'];

      it('is not imported, nor its WebAssembly compiled, until a compressed buffer is decoded', async () => {
        const { src, evaluated } = await isolated();
        const loader = new src.ThreeLoader();
        new src.ThreeSceneComponent();
        expect(evaluated).not.toHaveBeenCalled();
        expectDecoded(quadOf(await loader.loadFromGlb(glb())));
        expectDecoded(quadOf(await loader.loadFromGlb(glb())));
        expect(evaluated).toHaveBeenCalledTimes(1);
      });

      it('decodes on the main thread where there are no web workers, by default', async () => {
        const { src, fake } = await isolated();
        expectDecoded(quadOf(await new src.ThreeLoader().loadFromGlb(glb())));
        expect(fake.useWorkers).not.toHaveBeenCalled();
        expect(fake.decodeGltfBufferAsync).not.toHaveBeenCalledWith(...probe);
      });

      it('starts the workers useWorkers asks for, once one answers', async () => {
        const { src, fake, warn } = await isolated();
        src.lazyMeshoptDecoder.useWorkers(2);
        expectDecoded(quadOf(await new src.ThreeLoader().loadFromGlb(glb())));
        expect(fake.useWorkers.mock.calls).toEqual([[2]]);
        expect(fake.decodeGltfBufferAsync.mock.calls[0]).toEqual(probe);
        expect(fake.decodeGltfBufferAsync).toHaveBeenCalledTimes(3);
        expect(warn).not.toHaveBeenCalled();

        // resized later, before the next file
        src.lazyMeshoptDecoder.useWorkers(0);
        expectDecoded(quadOf(await new src.ThreeLoader().loadFromGlb(glb())));
        expect(fake.useWorkers.mock.calls).toEqual([[2], [0]]);
      });

      it('decodes on the main thread when the workers can not start', async () => {
        const { src, fake, warn } = await isolated();
        fake.useWorkers.mockImplementationOnce(() => {
          throw new Error('refused by the Content Security Policy');
        });
        src.lazyMeshoptDecoder.useWorkers(2);
        expectDecoded(quadOf(await new src.ThreeLoader().loadFromGlb(glb())));
        expect(fake.useWorkers.mock.calls).toEqual([[2], [0]]);
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('could not start'), expect.any(Error));
      });

      it('decodes on the main thread when the workers never answer', async () => {
        const { src, fake, warn } = await isolated(false);
        const realSetTimeout = setTimeout;
        jest.useFakeTimers();
        src.lazyMeshoptDecoder.useWorkers(2);
        const loading = new src.ThreeLoader().loadFromGlb(glb());
        // the wait starts once the decoder's WebAssembly compiled, on no timer of its own
        while (!fake.decodeGltfBufferAsync.mock.calls.length) {
          await new Promise(resolve => realSetTimeout(resolve, 0));
        }
        await jest.advanceTimersByTimeAsync(5000);
        expectDecoded(quadOf(await loading));
        expect(fake.useWorkers.mock.calls).toEqual([[2], [0]]);
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('did not answer'));
      });

      it('stops waiting for the workers once the Content Security Policy refuses them', async () => {
        const { src, fake, warn } = await isolated(false);
        src.lazyMeshoptDecoder.useWorkers(2);
        const loading = new src.ThreeLoader().loadFromGlb(glb());
        while (!fake.useWorkers.mock.calls.length) {
          await new Promise(resolve => setTimeout(resolve, 0));
        }
        // how Chrome reports a refused blob: worker - it doesn't throw, the worker just never runs
        document.dispatchEvent(
          Object.assign(new Event('securitypolicyviolation'), { effectiveDirective: 'worker-src', blockedURI: 'blob' }),
        );
        expectDecoded(quadOf(await loading));
        expect(fake.useWorkers.mock.calls).toEqual([[2], [0]]);
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('did not answer'));
      });

      it('runs the synchronous decode functions once ready, like three.js', async () => {
        const { src, fake } = await isolated();
        const args = [new Uint8Array(4), 1, 4, new Uint8Array(1), 'ATTRIBUTES'] as const;
        expect(() => src.lazyMeshoptDecoder.decodeGltfBuffer(...args)).toThrow('ready');
        await src.lazyMeshoptDecoder.ready;
        src.lazyMeshoptDecoder.decodeGltfBuffer(...args);
        expect(fake.decodeGltfBuffer).toHaveBeenCalledWith(...args, undefined);
      });
    });
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
