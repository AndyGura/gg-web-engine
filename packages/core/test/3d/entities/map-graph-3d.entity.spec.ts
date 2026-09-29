import { Gg3dWorld, MapGraph, MapGraph3dEntity, MapGraphNodeType } from '../../../src';

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
});
