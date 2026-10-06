import {
  CachingStrategy,
  Gg3dWorld,
  GroupEntity,
  IEntity,
  isAbortError,
  LevelJson,
  LoadProgress,
  LoadTaskOptions,
  MapGraph3dEntity,
  TickOrder,
} from '../../src';
import { mock3DBody } from '../mocks/body.mock';
import { mock3DObject } from '../mocks/object.mock';
import { mockFetch, MockFetch, restoreFetch } from '../mocks/fetch.mock';

class PlainEntity extends IEntity {
  public readonly tickOrder = TickOrder.OBJECTS_BINDING;
}

const displayObject = (log: string[], label: string): any => ({
  ...mock3DObject(),
  label,
  dispose: jest.fn(() => log.push(`dispose ${label}`)),
  clone: jest.fn(() => displayObject(log, `${label}#copy`)),
  popChild: () => displayObject(log, `${label}/child`),
  isEmpty: () => true,
});

const body = (log: string[], label: string): any => ({
  ...mock3DBody(),
  name: label,
  dispose: jest.fn(() => log.push(`dispose body ${label}`)),
  clone: jest.fn(() => body(log, `${label}#copy`)),
});

const meta = (dummies: any[] = []) => JSON.stringify({ dummies, curves: [], rigidBodies: [] });

describe('asset loading through Gg3dLoader', () => {
  let log: string[];
  let world: Gg3dWorld;
  let visualLoader: any;
  let audioFactory: any;
  let fetch: MockFetch;

  const files = {
    'assets/room.glb': { data: new Uint8Array(40), chunks: 4 },
    'assets/room.meta': meta([
      {
        name: 'Spot',
        is_prop: true,
        prop_id: 'radio',
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
      },
    ]),
    'assets/radio.glb': { data: new Uint8Array(20), chunks: 2 },
    'assets/radio.meta': meta(),
    'assets/hero.glb': { data: new Uint8Array(30), chunks: 3 },
    'sky.hdr': { data: new Uint8Array(16), chunks: 2 },
    'wall.png': { data: new Uint8Array(8), chunks: 2, contentLength: false },
    'wind.mp3': { data: new Uint8Array(10), chunks: 2 },
  };

  beforeEach(() => {
    log = [];
    fetch = mockFetch(files);
    visualLoader = {
      loadFromGgGlb: jest.fn(async () => displayObject(log, 'ggGlb')),
      loadFromGlb: jest.fn(async () => displayObject(log, 'model')),
      loadTexture: jest.fn(async (url: string) => `url-texture:${url}`),
      loadCubeTexture: jest.fn(async () => 'url-cube'),
      textureFromData: jest.fn(async (_data: Blob, options: any) => `texture:${options.url}`),
      disposeTexture: jest.fn((texture: string) => log.push(`dispose ${texture}`)),
      prepare: jest.fn(async () => {}),
    };
    audioFactory = {
      loadClip: jest.fn(async (url: string) => `url-clip:${url}`),
      decodeClip: jest.fn(async (data: ArrayBuffer) => `clip:${data.byteLength}`),
      createSource: jest.fn(() => ({
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        addToWorld: jest.fn(),
        removeFromWorld: jest.fn(),
        dispose: jest.fn(),
      })),
    };
    world = new Gg3dWorld({
      visualScene: {
        loader: visualLoader,
        factory: {},
        init: async () => {},
        dispose: () => log.push('dispose scene'),
        setEnvironment: jest.fn(),
        environment: { background: null, environmentMap: null, fog: null },
      },
      physicsWorld: {
        loader: { loadFromGgGlb: jest.fn(async () => [body(log, 'b')]) },
        init: async () => {},
        simulate: () => {},
        dispose: () => {},
      },
      audioScene: {
        factory: audioFactory,
        init: async () => {},
        update: () => {},
        dispose: () => {},
        activeListener: null,
        setActiveListener: () => {},
      },
    } as any);
  });

  afterEach(() => {
    world.dispose();
    restoreFetch();
  });

  const record = () => {
    const calls: LoadProgress[] = [];
    return { calls, onProgress: (p: LoadProgress) => calls.push(p), last: () => calls[calls.length - 1] };
  };
  const expectMonotonic = (calls: LoadProgress[]) => {
    for (let i = 1; i < calls.length; i++) {
      expect(calls[i].fraction).toBeGreaterThanOrEqual(calls[i - 1].fraction);
    }
  };
  const fetched = (url: string) => fetch.mock.calls.filter(c => c[0] === url).length;
  /** The fraction `progress` showed when each URL was requested. */
  const fractionWhenFetched = (progress: ReturnType<typeof record>) => {
    const shownAt: Record<string, number> = {};
    const original = fetch.getMockImplementation()!;
    fetch.mockImplementation((url: string, init?: any) => {
      shownAt[url] = progress.last()?.fraction ?? 0;
      return original(url, init);
    });
    return shownAt;
  };

  describe('loadGgGlb', () => {
    it('fetches and parses a file once per world and hands out copies of it', async () => {
      const first = await world.loader.loadGgGlb('assets/radio');
      const second = await world.loader.loadGgGlb('assets/radio');

      expect(fetched('assets/radio.glb')).toBe(1);
      expect(fetched('assets/radio.meta')).toBe(1);
      expect(visualLoader.loadFromGgGlb).toHaveBeenCalledTimes(1);
      expect((first.entities[0].object3D as any).label).toBe('ggGlb#copy');
      expect(first.entities[0].object3D).not.toBe(second.entities[0].object3D);
      expect(first.entities[0].objectBody!.name).toBe('b#copy');
    });

    it('shares one fetch between loads started at the same time', async () => {
      await Promise.all([world.loader.loadGgGlb('assets/radio'), world.loader.loadGgGlb('assets/radio')]);
      expect(fetched('assets/radio.glb')).toBe(1);
      expect(visualLoader.loadFromGgGlb).toHaveBeenCalledTimes(1);
    });

    it('reports bytes, then decoding, then completion - with props found in the meta added on the way', async () => {
      const progress = record();
      const shownAt = fractionWhenFetched(progress);
      const result = await world.loader.loadGgGlb('assets/room', { onProgress: progress.onProgress });
      // the props are part of the load: the root alone does not fill the bar
      expect(shownAt['assets/radio.glb']).toBeLessThanOrEqual(0.5);

      expect(result.props).toHaveLength(1);
      expectMonotonic(progress.calls);
      expect(progress.last()).toEqual(
        expect.objectContaining({
          fraction: 1,
          loadedItems: 2,
          totalItems: 2,
          bytesLoaded: 60 + 2 * 0 + files['assets/room.meta'].length + files['assets/radio.meta'].length,
        }),
      );
      // the room alone is known at first; its prop turns up once the meta is read
      expect(progress.calls[0].totalItems).toBe(1);
      expect(progress.calls.some(p => p.totalItems === 2 && p.loadedItems === 1)).toBe(true);
      // the bar is not full while the first file is still being parsed
      const beforeDecode = progress.calls.filter(p => p.loadedItems === 0);
      expect(Math.max(...beforeDecode.map(p => p.fraction))).toBeLessThan(1);
      expect(visualLoader.prepare).toHaveBeenCalledTimes(2);
    });

    it('without props, the root alone fills the bar: no empty slot holds the fraction down', async () => {
      const progress = record();
      await world.loader.loadGgGlb('assets/room', { loadProps: false, onProgress: progress.onProgress });

      expectMonotonic(progress.calls);
      expect(progress.last()).toEqual(expect.objectContaining({ fraction: 1, loadedItems: 1, totalItems: 1 }));
      // the root is fully fetched before decoding: more than half the way by then
      const beforeDecode = progress.calls.filter(p => p.loadedItems === 0);
      expect(Math.max(...beforeDecode.map(p => p.fraction))).toBeGreaterThan(0.5);
    });

    it('frees the cached original when the scope it was loaded with is released, not when a copy is disposed', async () => {
      const scope = world.loader.createAssetScope();
      const result = await world.loader.loadGgGlb('assets/radio', { scope });
      result.entities[0].dispose();
      expect(log.sort()).toEqual(['dispose body b#copy', 'dispose ggGlb#copy']);

      scope.release();
      expect(log.slice(2)).toEqual(['dispose ggGlb', 'dispose body b']);
      expect(world.loader.assetCache.size).toBe(0);
    });

    it('keeps an asset loaded without a scope until the world is disposed, before the scene goes', async () => {
      await world.loader.loadGgGlb('assets/radio');
      expect(log).toEqual([]);
      world.dispose();
      expect(log).toEqual(['dispose ggGlb', 'dispose body b', 'dispose scene']);
    });

    it('bypasses the cache with CachingStrategy.Nothing: the result is the parsed original', async () => {
      const first = await world.loader.loadGgGlb('assets/radio', { cachingStrategy: CachingStrategy.Nothing });
      await world.loader.loadGgGlb('assets/radio', { cachingStrategy: CachingStrategy.Nothing });
      expect(fetched('assets/radio.glb')).toBe(2);
      expect((first.entities[0].object3D as any).label).toBe('ggGlb');
      expect(world.loader.assetCache.size).toBe(0);
    });

    it('rejects with an AbortError when aborted mid-download and caches nothing', async () => {
      fetch.hold();
      const controller = new AbortController();
      const promise = world.loader.loadGgGlb('assets/radio', { signal: controller.signal }).catch(e => e);
      await Promise.resolve();
      controller.abort();
      fetch.release();
      expect(isAbortError(await promise)).toBe(true);
      expect(world.loader.assetCache.size).toBe(0);
      expect(visualLoader.loadFromGgGlb).not.toHaveBeenCalled();
    });
  });

  describe('single assets', () => {
    it('loadModel parses once and returns a copy per call', async () => {
      const progress = record();
      const a = await world.loader.loadModel('assets/hero', { onProgress: progress.onProgress });
      const b = await world.loader.loadModel('assets/hero');
      expect(fetched('assets/hero.glb')).toBe(1);
      expect((a as any).label).toBe('model#copy');
      expect(a).not.toBe(b);
      expect(progress.last()).toEqual(
        expect.objectContaining({ fraction: 1, loadedItems: 1, bytesLoaded: 30, bytesTotal: 30 }),
      );
    });

    it('loadTexture decodes fetched bytes, caches per url and options, and frees with its scope', async () => {
      const scope = world.loader.createAssetScope();
      const progress = record();
      const a = await world.loader.loadTexture('sky.hdr', {
        mapping: 'equirectangular',
        scope,
        onProgress: progress.onProgress,
      });
      const b = await world.loader.loadTexture('sky.hdr', { mapping: 'equirectangular', scope });
      expect(a).toBe('texture:sky.hdr');
      expect(b).toBe(a);
      expect(fetched('sky.hdr')).toBe(1);
      expect(visualLoader.textureFromData).toHaveBeenCalledWith(expect.any(Blob), {
        mapping: 'equirectangular',
        url: 'sky.hdr',
      });
      expect(visualLoader.loadTexture).not.toHaveBeenCalled();
      expect(visualLoader.prepare).toHaveBeenCalledWith('texture:sky.hdr');
      expect(progress.calls.map(p => p.bytesLoaded)).toEqual([0, 8, 16, 16, 16]);

      await world.loader.loadTexture('sky.hdr', { scope });
      expect(fetched('sky.hdr')).toBe(2);

      // the same file with different options at the same time: decoded twice, downloaded once
      await Promise.all([
        world.loader.loadTexture('sky.hdr', { scope, filter: 'nearest' }),
        world.loader.loadTexture('sky.hdr', { scope, filter: 'linear' }),
      ]);
      expect(fetched('sky.hdr')).toBe(3);
      expect(world.loader.assetCache.has('data:sky.hdr')).toBe(false);

      scope.release();
      expect(visualLoader.disposeTexture).toHaveBeenCalledTimes(4);
    });

    it('reports an unknown byte total, and still completes, when Content-Length is hidden', async () => {
      const progress = record();
      await world.loader.loadTexture('wall.png', { onProgress: progress.onProgress });
      expect(progress.calls.some(p => p.bytesTotal === null)).toBe(true);
      expect(progress.last().fraction).toBe(1);
      expectMonotonic(progress.calls);
    });

    it('falls back to the url loader of an adapter that cannot decode bytes', async () => {
      delete visualLoader.textureFromData;
      expect(await world.loader.loadTexture('sky.hdr')).toBe('url-texture:sky.hdr');
      expect(fetch).not.toHaveBeenCalled();
    });

    it('loadClip decodes fetched bytes once', async () => {
      const a = await world.loader.loadClip('wind.mp3');
      const b = await world.loader.loadClip('wind.mp3');
      expect(a).toBe('clip:10');
      expect(b).toBe(a);
      expect(audioFactory.decodeClip).toHaveBeenCalledTimes(1);
      expect(audioFactory.loadClip).not.toHaveBeenCalled();
    });

    it('preload brings assets into the cache under one progress', async () => {
      const progress = record();
      await world.loader.preload(
        [
          { kind: 'ggGlb', url: 'assets/room' },
          { kind: 'glb', url: 'assets/hero' },
          { kind: 'texture', url: 'sky.hdr' },
          { kind: 'clip', url: 'wind.mp3' },
        ],
        { onProgress: progress.onProgress },
      );
      expect(progress.last()).toEqual(expect.objectContaining({ fraction: 1, loadedItems: 5, totalItems: 5 }));
      expectMonotonic(progress.calls);
      const calls = fetch.mock.calls.length;
      await world.loader.loadGgGlb('assets/room');
      await world.loader.loadModel('assets/hero');
      expect(fetch.mock.calls.length).toBe(calls);
    });
  });

  describe('loadLevel', () => {
    const level: LevelJson = {
      entities: [
        { class: 'Glb', name: 'Room', config: { path: 'assets/room' } },
        { class: 'Environment', name: 'Env', config: { environmentMap: { equirectangular: 'sky.hdr' } } },
        { class: 'Sound', name: 'Wind', config: { path: 'wind.mp3' } },
        { class: 'Custom', name: 'Hero' },
      ],
    };

    beforeEach(() => {
      // an app class with no `assets` hook: it loads through the loader with the options it is handed
      world.loader.registerClass('Custom', async (w: Gg3dWorld, _settings: any, load: LoadTaskOptions) => {
        await w.loader.loadModel('assets/hero', load);
        return new PlainEntity();
      });
    });

    it('loads every declared asset in parallel before building, under one progress', async () => {
      const started: string[] = [];
      fetch.mockImplementation(
        (original => (url: string, init?: any) => {
          started.push(url);
          return original(url, init);
        })(fetch.getMockImplementation()!),
      );
      const buildStartedAfter: number[] = [];
      const glb = jest.spyOn(world.loader, 'loadGgGlb');
      glb.mockImplementationOnce(function (this: any, ...args: any[]) {
        buildStartedAfter.push(started.length);
        glb.mockRestore();
        return (world.loader.loadGgGlb as any)(...args);
      } as any);

      const progress = record();
      const group = await world.loader.loadLevel(level, 'L', { onProgress: progress.onProgress });

      // room (+ its meta), the prop the room references, the sky and the clip were all requested
      // before the first generator ran
      expect(buildStartedAfter[0]).toBe(6);
      expect(started.slice(0, 4).sort()).toEqual(['assets/room.glb', 'assets/room.meta', 'sky.hdr', 'wind.mp3']);
      // nothing declared was fetched twice
      for (const url of ['assets/room.glb', 'assets/radio.glb', 'sky.hdr', 'wind.mp3']) {
        expect(fetched(url)).toBe(1);
      }
      // the hook-less class's model is counted from the moment its generator asks for it
      expect(progress.last()).toEqual(expect.objectContaining({ fraction: 1, loadedItems: 5, totalItems: 5 }));
      expect(progress.calls.some(p => p.totalItems === 4)).toBe(true);
      expectMonotonic(progress.calls);
      expect(group.getChildEntityByName('Hero')).toBeInstanceOf(PlainEntity);
    });

    it('frees what only the level used when the level is removed', async () => {
      const group = await world.loader.loadLevel(level, 'L');
      expect(world.loader.assetCache.size).toBe(5);
      world.removeEntity(group, true);
      expect(world.loader.assetCache.size).toBe(0);
      expect(log).toEqual(expect.arrayContaining(['dispose ggGlb', 'dispose model', 'dispose texture:sky.hdr']));
      // copies went before the originals they share resources with
      expect(log.indexOf('dispose ggGlb#copy')).toBeLessThan(log.indexOf('dispose ggGlb'));
    });

    it('keeps assets a second level shares when the first one is removed after it loaded', async () => {
      const first = await world.loader.loadLevel(level, 'A');
      const calls = fetch.mock.calls.length;
      const second = await world.loader.loadLevel(
        {
          entities: [
            { class: 'Environment', name: 'Env2', config: { environmentMap: { equirectangular: 'sky.hdr' } } },
          ],
        },
        'B',
      );
      expect(fetch.mock.calls.length).toBe(calls);

      world.removeEntity(first, true);
      expect(visualLoader.disposeTexture).not.toHaveBeenCalled();
      expect(world.loader.assetCache.size).toBe(1);

      world.removeEntity(second, true);
      expect(visualLoader.disposeTexture).toHaveBeenCalledWith('texture:sky.hdr');
    });

    it('aborts: rejects with an AbortError, leaves no level and no cached assets behind', async () => {
      fetch.hold();
      const controller = new AbortController();
      const promise = world.loader.loadLevel(level, 'L', { signal: controller.signal }).catch(e => e);
      await Promise.resolve();
      controller.abort();
      fetch.release();
      expect(isAbortError(await promise)).toBe(true);
      expect(() => world.getEntityByName('L')).toThrow();
      expect(world.loader.assetCache.size).toBe(0);
    });

    it('a failing asset cancels the rest of the preload and rejects with its own error', async () => {
      visualLoader.textureFromData.mockRejectedValueOnce(new Error('bad image'));
      // a decode that never ends: the preload must not wait for it
      audioFactory.decodeClip.mockImplementationOnce(() => new Promise(() => {}));
      const error = await world.loader
        .preload([
          { kind: 'clip', url: 'wind.mp3' },
          { kind: 'texture', url: 'wall.png' },
        ])
        .catch(e => e);
      expect(error.message).toBe('bad image');
      expect(world.loader.assetCache.size).toBe(0);
    });

    it('disposing the world cancels its loads', async () => {
      fetch.hold();
      const promise = world.loader.loadGgGlb('assets/radio').catch(e => e);
      await Promise.resolve();
      world.dispose();
      expect(isAbortError(await promise)).toBe(true);
      expect(visualLoader.loadFromGgGlb).not.toHaveBeenCalled();
      await expect(world.loader.loadTexture('wall.png')).rejects.toHaveProperty('name', 'AbortError');
      // afterEach disposes again
      world = { dispose: () => {} } as any;
      fetch.release();
    });

    it('counts the chunks a MapGraph loads first as part of the level, and holds them no longer than its chunks', async () => {
      const progress = record();
      const scopes = jest.spyOn(world.loader, 'createAssetScope');
      const group = await world.loader.loadLevel(
        {
          entities: [
            {
              class: 'MapGraph',
              config: {
                graph: {
                  nodes: [
                    { path: 'assets/radio', position: { x: 0, y: 0, z: 0 } },
                    { path: 'assets/hero', position: { x: 1000, y: 0, z: 0 } },
                  ],
                },
                loadDepth: 0,
              },
            },
          ],
        },
        'L',
        { onProgress: progress.onProgress },
      );
      // the nearest chunk to the cursor was loaded before the level resolved, the far one wasn't
      expect(progress.last()).toEqual(expect.objectContaining({ fraction: 1, loadedItems: 1, totalItems: 1 }));
      expect(fetched('assets/radio.glb')).toBe(1);
      expect(fetched('assets/hero.glb')).toBe(0);
      await new Promise(resolve => setTimeout(resolve, 0));
      // the chunk itself found it in the cache
      expect(fetched('assets/radio.glb')).toBe(1);
      // level scope, preload hold, the chunk's own scope: the hold let go once the chunk took over
      const [levelScope, hold, chunkScope] = scopes.mock.results.map(r => r.value);
      expect([levelScope.released, hold.released, chunkScope.released]).toEqual([false, true, false]);
      world.removeEntity(group, true);
      expect(world.loader.assetCache.size).toBe(0);
    });

    it("keeps a chunk's assets for an entity detached from it until that entity is disposed", async () => {
      const node = { path: 'assets/radio', position: { x: 0, y: 0, z: 0 } };
      const group = await world.loader.loadLevel(
        { entities: [{ class: 'MapGraph', name: 'Map', config: { graph: { nodes: [node] }, loadDepth: 0 } }] },
        'L',
      );
      await new Promise(resolve => setTimeout(resolve, 0));
      const mapGraph = group.getChildEntityByName<MapGraph3dEntity>('Map');
      const [chunkNode, entities] = [...mapGraph.loaded.entries()][0];
      const vehicle = entities[0];
      mapGraph.detachFromChunk([vehicle]);

      (mapGraph as any).disposeChunk(chunkNode);
      // the copy the vehicle renders still has the original's geometry
      expect(log).not.toContain('dispose ggGlb');
      expect(vehicle.disposed).toBe(false);

      vehicle.dispose();
      expect(log).toContain('dispose ggGlb');
      world.removeEntity(group, true);
    });

    it('loadLevelFromUrl counts the level document and everything in it', async () => {
      (files as any)['level.json'] = JSON.stringify(level);
      const progress = record();
      const shownAt = fractionWhenFetched(progress);
      const group = await world.loader.loadLevelFromUrl('level.json', 'L', { onProgress: progress.onProgress });
      expect(group).toBeInstanceOf(GroupEntity);
      expect(progress.last()).toEqual(expect.objectContaining({ fraction: 1, loadedItems: 6, totalItems: 6 }));
      expectMonotonic(progress.calls);
      // the document alone is not the level: the bar is far from full when its assets start
      expect(shownAt['assets/room.glb']).toBeLessThanOrEqual(0.5);
    });

    it('gives an entity built on its own a scope that ends with the entity', async () => {
      const entity = await world.loader.createEntity({
        class: 'Environment',
        config: { environmentMap: { equirectangular: 'sky.hdr' } },
      });
      expect(world.loader.assetCache.size).toBe(1);
      entity!.dispose();
      expect(world.loader.assetCache.size).toBe(0);
      expect(visualLoader.disposeTexture).toHaveBeenCalledWith('texture:sky.hdr');
    });

    it('collects the clips of PlaySound blueprint nodes as level assets', () => {
      const refs = world.loader.collectLevelAssets({
        entities: [
          {
            class: 'Trigger',
            events: { onEntityEntered: { type: 'PlaySound', settings: { clip: 'a.mp3' } }, onEntityLeft: 'Chime' },
          },
        ],
        blueprints: {
          Chime: {
            nodes: [
              {
                id: 'n',
                type: 'PlaySound',
                settings: { clip: 'b.mp3', impactClips: [{ clip: 'c.mp3', minImpulse: 1 }] },
              },
            ],
            inputs: {},
          },
        } as any,
      });
      expect(refs).toEqual([
        { kind: 'clip', url: 'a.mp3' },
        { kind: 'clip', url: 'b.mp3' },
        { kind: 'clip', url: 'c.mp3' },
      ]);
    });
  });
});
