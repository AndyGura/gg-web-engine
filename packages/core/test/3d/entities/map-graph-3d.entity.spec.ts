import { Entity3d, Gg3dWorld, MapGraph, MapGraph3dEntity, MapGraphNodeType } from '../../../src';

describe('MapGraph3dEntity', () => {
  let world: Gg3dWorld;

  beforeEach(async () => {
    world = new Gg3dWorld({
      visualScene: { init: async () => {}, dispose: () => {} } as any,
      physicsWorld: { init: async () => {}, simulate: () => {}, dispose: () => {} } as any,
    });
    await world.init();
    // Drive the world's tick loop manually (no real/fake timers involved at all) - matches the
    // console "step" command's own pattern (start, then immediately pause, so `step()` can fire
    // exact, fully controlled ticks going forward).
    world.worldClock.start();
    world.worldClock.pause();
  });

  const step = (ms: number = 1000 / 120) => world.worldClock.step(ms);

  // Chases a resolved mock loader promise through `await loadGgGlb()` -> the rest of
  // `loadChunk()` -> `loadChunk()`'s own returned promise settling -> `Promise.all(...)` settling
  // -> its `.then()` callback actually running - each step is its own microtask hop, so a single
  // `await Promise.resolve()` isn't enough.
  const flushMicrotasks = async (hops: number = 10) => {
    for (let i = 0; i < hops; i++) {
      await Promise.resolve();
    }
  };

  it("unloads a chunk whose loadChunk() only resolves after nearestDummy already moved on and stopped changing - even though no later scan is ever triggered by a nearestDummy change to notice it's stale", async () => {
    // Two nodes far enough apart that only one is ever within loadDepth 0 of the cursor at a time.
    const nodeA: MapGraphNodeType = { path: 'a', position: { x: 0, y: 0, z: 0 }, loadOptions: {} };
    const nodeB: MapGraphNodeType = { path: 'b', position: { x: 1000, y: 0, z: 0 }, loadOptions: {} };
    const graph = MapGraph.fromMapArray([nodeA, nodeB]);

    let resolveA!: (v: unknown) => void;
    const pendingA = new Promise(resolve => {
      resolveA = resolve;
    });
    jest.spyOn(world.loader, 'loadGgGlb').mockImplementation((path: string): any => {
      if (path === 'a') {
        return pendingA;
      }
      return Promise.resolve({ entities: [], meta: { dummies: [] } });
    });

    const mapGraphEntity = new MapGraph3dEntity(graph, { loadDepth: 0, inertia: 0, maxNodesLoadingPerTick: 10 });
    // The load clock defaults to at most 1 tick/sec - irrelevant to what's under test here, and
    // would otherwise swallow the tiny steps below outright.
    mapGraphEntity.loadRateLimit = 0;
    // Spawning synchronously computes the initial load list (nearestDummy = nodeA, the cursor's
    // default position) and immediately kicks off loadChunk(nodeA) - see onSpawned's own
    // `startWith(null)` comments. nodeA is now in `loadingNodes`, awaiting `pendingA`.
    world.addEntity(mapGraphEntity);
    expect(mapGraphEntity.loaded.has(nodeA)).toBe(false);

    // Move away from A to B, and settle there - this is the one nearestDummy transition that will
    // ever happen for the rest of the test, so the unload-candidate scan only ever runs once more,
    // right here, and never again. At this instant nodeA isn't in `this.loaded` yet (still
    // in-flight), so it's invisible to that scan - it neither gets queued for unload here nor
    // (before this fix) at any point afterward.
    mapGraphEntity.loaderCursor$.next(nodeB.position);
    step();

    // Now let nodeA's load actually finish, well after nearestDummy settled at B.
    resolveA({ entities: [], meta: { dummies: [] } });
    await flushMicrotasks();

    expect(mapGraphEntity.loaded.has(nodeA)).toBe(true);

    // No further nearestDummy change ever happens, so the only thing that can still notice nodeA
    // fell out of scope is the post-load staleness check - give it the next tick to act.
    step();

    expect(mapGraphEntity.loaded.has(nodeA)).toBe(false);
  });

  it('cancels a chunk load in flight when removed from the world, and frees what it loaded anyway', async () => {
    const node: MapGraphNodeType = { path: 'a', position: { x: 0, y: 0, z: 0 }, loadOptions: {} };
    let finish!: (v: unknown) => void;
    let signal: AbortSignal | undefined;
    // a load that ignores its signal and finishes after the removal
    jest.spyOn(world.loader, 'loadGgGlb').mockImplementation((_path: string, options: any): any => {
      signal = options.signal;
      return new Promise(resolve => (finish = resolve));
    });
    const createScope = jest.spyOn(world.loader, 'createAssetScope');
    const mapGraphEntity = new MapGraph3dEntity(MapGraph.fromMapArray([node]), { loadDepth: 0, inertia: 0 });
    world.addEntity(mapGraphEntity);
    const scope = createScope.mock.results[0].value;

    world.removeEntity(mapGraphEntity, true);
    expect(signal!.aborted).toBe(true);
    const chunkEntity = new Entity3d({});
    finish({ entities: [chunkEntity], meta: { dummies: [] } });
    await flushMicrotasks();

    expect(chunkEntity.disposed).toBe(true);
    expect(scope.released).toBe(true);
    expect(mapGraphEntity.loaded.size).toBe(0);
  });

  describe('attachToChunk / detachFromChunk', () => {
    const nodeA: MapGraphNodeType = { path: 'a', position: { x: 0, y: 0, z: 0 }, loadOptions: {} };
    const nodeB: MapGraphNodeType = { path: 'b', position: { x: 1000, y: 0, z: 0 }, loadOptions: {} };
    let mapGraphEntity: MapGraph3dEntity;

    // loads only the node nearest to the cursor: moving the cursor swaps which one is loaded
    const moveTo = async (node: MapGraphNodeType) => {
      mapGraphEntity.loaderCursor$.next(node.position);
      // the nearest node changes on the load clock's tick; the unload/load lists it computes are
      // applied by this entity's own tick, which may already have run in that same step
      step();
      step();
      await flushMicrotasks();
    };

    beforeEach(async () => {
      jest
        .spyOn(world.loader, 'loadGgGlb')
        .mockImplementation((): any => Promise.resolve({ entities: [], meta: { dummies: [] } }));
      mapGraphEntity = new MapGraph3dEntity(MapGraph.fromMapArray([nodeA, nodeB]), {
        loadDepth: 0,
        inertia: 0,
        maxNodesLoadingPerTick: 10,
      });
      mapGraphEntity.loadRateLimit = 0;
      world.addEntity(mapGraphEntity);
      await flushMicrotasks();
      expect(mapGraphEntity.loaded.has(nodeA)).toBe(true);
    });

    it('removes and disposes an attached entity when its chunk unloads', async () => {
      const entity = new Entity3d({});
      mapGraphEntity.attachToChunk(nodeA, [entity]);
      expect(entity.world).toBe(world);

      await moveTo(nodeB);

      expect(mapGraphEntity.loaded.has(nodeA)).toBe(false);
      expect(entity.world).toBeNull();
      expect(entity.disposed).toBe(true);
    });

    it('keeps a detached entity spawned when its former chunk unloads, without respawning it', async () => {
      const entity = new Entity3d({});
      mapGraphEntity.attachToChunk(nodeA, [entity]);
      const removed = jest.fn();
      world.entityRemoved$.subscribe(removed);

      expect(mapGraphEntity.detachFromChunk([entity])).toEqual([entity]);
      await moveTo(nodeB);

      expect(mapGraphEntity.loaded.has(nodeA)).toBe(false);
      expect(entity.world).toBe(world);
      expect(entity.disposed).toBe(false);
      expect(removed).not.toHaveBeenCalledWith(entity);
    });

    it('skips an entity that is not attached to any chunk', () => {
      const entity = new Entity3d({});
      world.addEntity(entity);

      expect(mapGraphEntity.detachFromChunk([entity])).toEqual([]);
      expect(entity.world).toBe(world);
    });

    it('re-attaches a detached entity to another chunk in place, and unloads it with that chunk', async () => {
      const entity = new Entity3d({});
      mapGraphEntity.attachToChunk(nodeA, [entity]);
      mapGraphEntity.detachFromChunk([entity]);
      await moveTo(nodeB);
      const removed = jest.fn();
      world.entityRemoved$.subscribe(removed);

      mapGraphEntity.attachToChunk(nodeB, [entity]);

      expect(entity.world).toBe(world);
      expect(removed).not.toHaveBeenCalled();

      await moveTo(nodeA);

      expect(entity.world).toBeNull();
      expect(entity.disposed).toBe(true);
    });

    it('moves an entity attached to one chunk over to another', async () => {
      // both nodes loaded at once
      world.removeEntity(mapGraphEntity, true);
      mapGraphEntity = new MapGraph3dEntity(MapGraph.fromMapArray([nodeA, nodeB]), {
        loadDepth: 1,
        inertia: 0,
        maxNodesLoadingPerTick: 10,
      });
      mapGraphEntity.loadRateLimit = 0;
      world.addEntity(mapGraphEntity);
      await flushMicrotasks();
      const entity = new Entity3d({});
      mapGraphEntity.attachToChunk(nodeA, [entity]);

      mapGraphEntity.attachToChunk(nodeB, [entity]);

      expect(mapGraphEntity.loaded.get(nodeA)).not.toContain(entity);
      expect(mapGraphEntity.loaded.get(nodeB)).toEqual([entity]);
      expect(entity.world).toBe(world);
    });
  });
});
