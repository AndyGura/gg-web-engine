import { BehaviorSubject, Observable, startWith, Subject, takeUntil } from 'rxjs';
import { distinctUntilChanged, map, tap } from 'rxjs/operators';
import { Graph, IEntity, PausableClock, Pnt3, Point3, Point4, Qtrn, TickOrder } from '../../base';
import { Gg3dWorld, Gg3dWorldTypeDocRepo } from '../gg-3d-world';
import { Entity3d } from './entity-3d';
import { LoadOptions, LoadResultWithProps } from '../loader';
import { IPositionable3d } from '../interfaces/i-positionable-3d';
import { IRenderable3dEntity } from './i-renderable-3d.entity';

export type MapGraphNodeType = {
  path: string;
  position: Point3;
  rotation?: Point4;
  loadOptions: Partial<Omit<LoadOptions, 'position' | 'rotation'>>;
};

export class MapGraph extends Graph<MapGraphNodeType> {
  /**
   * Creates a new MapGraph instance from an array of elements, where each element in the array is a node in the graph.
   * The first element of the array is used as the root node of the graph.
   * @param array The array of elements to create the graph from.
   * @param closed An optional boolean indicating whether the graph is closed, meaning that the last node is adjacent to the first node.
   * @returns A new Graph instance created from the array.
   * @typeparam T The type of elements in the array and nodes in the graph.
   */
  static fromMapArray(array: MapGraphNodeType[], closed: boolean = false): MapGraph {
    const root = new MapGraph(array[0]);
    let tail = root;
    for (let i = 1; i < array.length; i++) {
      const newTail = new MapGraph(array[i]);
      tail.addAdjacent(newTail);
      tail = newTail;
    }
    if (closed) {
      tail.addAdjacent(root);
    }
    return root;
  }

  /**
   * Creates a new MapGraph instance from a two-dimensional square grid of elements, where each element in the grid is a node in the graph.
   * The top-left element of the grid is used as the root node of the graph.
   * The nodes in the graph are created in the same order as the elements in the grid, from left to right and then from top to bottom.
   * @param grid The two-dimensional square grid of elements to create the graph from.
   * @returns A new Graph instance created from the square grid.
   * @typeparam T The type of elements in the square grid and nodes in the graph.
   */
  static fromMapSquareGrid(grid: MapGraphNodeType[][]): MapGraph {
    const nodes = grid.map(sgrid => sgrid.map(item => new MapGraph(item)));
    // bind them
    for (let j = 0; j < nodes.length; j++) {
      for (let i = 0; i < nodes.length; i++) {
        if (i > 0) {
          nodes[j][i].addAdjacent(nodes[j][i - 1]);
        }
        if (j > 0) {
          nodes[j][i].addAdjacent(nodes[j - 1][i]);
        }
      }
    }
    return nodes[0][0];
  }

  public getNearestDummy(thisNodes: Graph<MapGraphNodeType>[], cursor: Point3): Graph<MapGraphNodeType> {
    let min = Infinity;
    let node: Graph<MapGraphNodeType> = this;
    // TODO should be heavily optimized with kd-tree-javascript, but building spatial index takes too much time. Serialize to file?
    thisNodes.forEach(n => {
      let dist = Math.sqrt(
        Math.pow(cursor.x - n.data.position.x, 2) +
          Math.pow(cursor.y - n.data.position.y, 2) +
          Math.pow(cursor.z - n.data.position.z, 2),
      );
      if (dist < min) {
        min = dist;
        node = n;
      }
    });
    return node;
  }

  // TODO return iterable?
  nodes(): MapGraph[] {
    return Array.from(this.walkRead(-1)) as MapGraph[];
  }
}

export type Gg3dMapGraphEntityOptions = {
  // depth in tree to load. 0 means load only the nearest node, 1 means nearest + all of it's neighbours etc.
  loadDepth: number;
  // additional depth, means unload delay. Nodes with this depth won't load, but if already loaded, will not be destroyed
  inertia: number;
  // max amount of nodes that can be loaded on single tick. Use this to avoid framerate drop when loading multiple heavy nodes at once
  maxNodesLoadingPerTick: number;
};

const defaultOptions: Gg3dMapGraphEntityOptions = {
  loadDepth: 5,
  inertia: 0,
  maxNodesLoadingPerTick: 1,
};

export class MapGraph3dEntity<
  TypeDoc extends Gg3dWorldTypeDocRepo = Gg3dWorldTypeDocRepo,
> extends IRenderable3dEntity<TypeDoc> {
  static readonly entityTypeName: string = 'MapGraph3dEntity';
  public readonly tickOrder = TickOrder.POST_RENDERING;

  public readonly loaderCursor$: BehaviorSubject<Point3> = new BehaviorSubject<Point3>(Pnt3.O);
  readonly loaded: Map<MapGraphNodeType, (IEntity & IPositionable3d)[]> = new Map();

  /**
   * Nodes currently mid-`loadChunk()` - awaiting `loader.loadGgGlb()`, not yet in `loaded`. Without
   * this, a node can be handed to `loadChunk()` a second time while the first call is still
   * in-flight: the load-list computation below only excludes a node already present in `loaded`
   * (a *completed* load), and `loadList` itself is cleared the instant it's handed to
   * `Promise.all(...).then()` (fire-and-forget, not awaited by the tick subscription) - so a node
   * whose load hasn't finished yet can be re-queued and re-loaded on a later tick, which used to
   * produce two independent, concurrently-resolving `loadChunk()` calls for the same node/position -
   * real, reproduced symptom: flying back and forth over the same chunk repeatedly (unload before
   * the first load finishes, then reload) could fire `chunkLoaded$` twice for that one chunk, and
   * app code reacting to it (e.g. spawning cars keyed by chunk position + dummy name, not by which
   * of the two concurrent loads produced them) would compute the *same* name twice and collide on
   * `world.addEntity` the second time - silently losing that whole batch, since nothing in this
   * engine's own `chunkLoaded$` plumbing awaits or catches an async subscriber's own rejection.
   */
  private readonly loadingNodes: Set<MapGraphNodeType> = new Set();

  private _initialLoadComplete$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
  public get initialLoadComplete$(): Observable<boolean> {
    return this._initialLoadComplete$.asObservable();
  }

  private _nearestDummy$: BehaviorSubject<Graph<MapGraphNodeType> | null> =
    new BehaviorSubject<Graph<MapGraphNodeType> | null>(null);

  public get nearestDummy(): Graph<MapGraphNodeType> | null {
    return this._nearestDummy$.getValue();
  }

  protected _chunkLoaded$: Subject<
    [
      LoadResultWithProps<TypeDoc>,
      {
        position: Point3;
        rotation: Point4;
      },
      MapGraphNodeType,
    ]
  > = new Subject<[LoadResultWithProps<TypeDoc>, { position: Point3; rotation: Point4 }, MapGraphNodeType]>();
  /**
   * Fires once per loaded chunk, carrying the load result, its resolved position/rotation, and the
   * `MapGraphNodeType` node itself (the same object identity `attachToChunk` expects) - the third
   * element is for app code that spawns *additional* content per chunk beyond what the chunk's own
   * GLB contains (e.g. traffic placed at that chunk's dummies), so it has a handle to pass to
   * `attachToChunk` and get that content cleaned up automatically on unload too.
   */
  public get chunkLoaded$(): Observable<
    [
      LoadResultWithProps<TypeDoc>,
      {
        position: Point3;
        rotation: Point4;
      },
      MapGraphNodeType,
    ]
  > {
    return this._chunkLoaded$.asObservable();
  }

  protected readonly mapGraphNodes: MapGraph[];

  protected readonly options: Gg3dMapGraphEntityOptions;

  protected loadClock: PausableClock | null = null;

  private _loadRateLimit: number = 1;
  get loadRateLimit(): number {
    return this._loadRateLimit;
  }

  set loadRateLimit(value: number) {
    this._loadRateLimit = value;
    if (this.loadClock) {
      this.loadClock.tickRateLimit = value;
    }
  }

  constructor(
    public readonly mapGraph: MapGraph,
    options: Partial<Gg3dMapGraphEntityOptions> = {},
  ) {
    super();
    this.options = { ...defaultOptions, ...options };
    this.mapGraphNodes = mapGraph.nodes();
  }

  onSpawned(world: Gg3dWorld<TypeDoc>) {
    super.onSpawned(world);
    this.loadClock = world.createClock(true);
    this.loadClock.tickRateLimit = this._loadRateLimit;

    let loadList: MapGraphNodeType[] = [];
    let unloadList: MapGraphNodeType[] = [];
    // The most recently computed "still allowed to stay loaded" set, kept around so a chunk whose
    // `loadChunk()` finishes *after* this moved on can be checked against it directly - see
    // `queueIfNowStale`'s own doc for why that's needed at all.
    let lastCanBeLoaded: Set<MapGraphNodeType> = new Set();

    this.loadClock!.tick$.pipe(
      startWith(null), // map will perform initial loading even if world not started yet. Handy to preload map
      takeUntil(this._onRemoved$),
      map(() => this.mapGraph.getNearestDummy(this.mapGraphNodes, this.loaderCursor$.getValue())),
      distinctUntilChanged(),
      tap(node => this._nearestDummy$.next(node)),
    ).subscribe(currentChunk => {
      let haveToBeLoaded: Set<MapGraphNodeType> = new Set();
      let canBeLoaded: Set<MapGraphNodeType>;
      if (this.options.inertia > 0) {
        canBeLoaded = new Set();
        const nodes = currentChunk.walkReadPreserveDepth(this.options.loadDepth + this.options.inertia);
        for (let distance = 0; distance < nodes.length; distance++) {
          nodes[distance].forEach(node => canBeLoaded.add(node.data));
          if (distance <= this.options.loadDepth) {
            nodes[distance].forEach(node => haveToBeLoaded.add(node.data));
          }
        }
      } else {
        currentChunk.walkRead(this.options.loadDepth).forEach(node => haveToBeLoaded.add(node.data));
        canBeLoaded = haveToBeLoaded;
      }
      lastCanBeLoaded = canBeLoaded;
      for (const loadedNode of this.loaded.keys()) {
        if (!canBeLoaded.has(loadedNode)) {
          if (!unloadList.includes(loadedNode)) {
            unloadList.push(loadedNode);
          }
        } else {
          haveToBeLoaded.delete(loadedNode);
        }
      }
      // A node already mid-load must not be queued again - see `loadingNodes`'s own doc for why
      // that's reachable even though `loadList` itself is deduped (it gets cleared before the load
      // it queued actually finishes).
      for (const loadingNode of this.loadingNodes) {
        haveToBeLoaded.delete(loadingNode);
      }
      for (let n of Array.from(haveToBeLoaded.keys())) {
        if (!loadList.includes(n)) {
          loadList.push(n);
        }
      }
    });
    /**
     * The unload-candidate scan above only runs when `nearestDummy` actually changes to a value
     * distinct from its immediate predecessor - a node whose `loadChunk()` is still in flight at
     * that moment is invisible to it (it's tracked in `loadingNodes`, not yet `this.loaded`), so it
     * never gets a chance to land in `unloadList` for that transition. If `nearestDummy` then
     * settles and stops changing before that load actually resolves, no *later* scan ever
     * reconsiders it either - the node stays loaded indefinitely even though it already fell
     * outside `canBeLoaded` by the time it finished. Called right after each `loadChunk()`
     * settles (successfully) to close that gap: re-checks the node against the load-eligibility
     * set as it stood the moment loading finished, and queues it for unload immediately if it's
     * already stale, instead of waiting for a `nearestDummy` change that may never come.
     */
    const queueIfNowStale = (node: MapGraphNodeType) => {
      if (this.loaded.has(node) && !lastCanBeLoaded.has(node) && !unloadList.includes(node)) {
        unloadList.push(node);
      }
    };
    this.tick$
      .pipe(
        startWith(null), // map will perform initial loading even if world not started yet. Handy to preload map
        takeUntil(this._onRemoved$),
      )
      .subscribe(() => {
        if (unloadList.length) {
          for (const n of unloadList) {
            this.disposeChunk(n);
          }
          unloadList = [];
        }
        if (loadList.length) {
          if (this._initialLoadComplete$.value && loadList.length > this.options.maxNodesLoadingPerTick) {
            let loadNow = loadList.slice(0, this.options.maxNodesLoadingPerTick);
            loadList = loadList.slice(this.options.maxNodesLoadingPerTick);
            Promise.all(loadNow.map(n => this.loadChunk(n))).then(() => loadNow.forEach(queueIfNowStale));
          } else {
            const loadingNow = loadList;
            Promise.all(loadingNow.map(n => this.loadChunk(n))).then(() => {
              loadingNow.forEach(queueIfNowStale);
              if (!this._initialLoadComplete$.value) {
                this._initialLoadComplete$.next(true);
              }
            });
            loadList = [];
          }
        }
      });
  }

  onRemoved() {
    super.onRemoved();
    if (this.loadClock) {
      this.loadClock.stop();
      this.loadClock = null;
    }
    this.loaderCursor$.next(Pnt3.O);
  }

  protected async loadChunk(node: MapGraphNodeType): Promise<[Entity3d<TypeDoc>[], LoadResultWithProps<TypeDoc>]> {
    this.loadingNodes.add(node);
    try {
      const loaded = await this.world!.loader.loadGgGlb(node.path, {
        position: node.position,
        rotation: node.rotation || Qtrn.O,
        ...node.loadOptions,
      });
      const entities = [
        ...loaded.entities,
        ...(loaded.props || [])
          .map(p => p.entities)
          .reduce((p, c) => {
            p.push(...c);
            return p;
          }, []),
      ];
      this.loaded.set(node, entities);
      this.addChildren(...entities);
      this._chunkLoaded$.next([loaded, { position: node.position, rotation: node.rotation || Qtrn.O }, node]);
      return [entities, loaded];
    } finally {
      this.loadingNodes.delete(node);
    }
  }

  /**
   * Attaches already-constructed entities to an already-loaded chunk's own lifecycle: added as
   * children now (same as the chunk's own GLB-loaded entities), and automatically removed/disposed
   * the next time that chunk unloads. For content spawned in reaction to `chunkLoaded$` that isn't
   * itself part of the chunk's GLB (e.g. traffic placed per-chunk by app code) - without this, such
   * content has no lifecycle tied to the chunk at all, and leaks (and, if it reuses names on a later
   * reload while the leaked copy is still around, collides with them) once the chunk unloads.
   * @param node - The chunk this content belongs to, as received via `chunkLoaded$`'s third tuple element
   * @param entities - The entities to attach
   * An entity currently attached to another chunk (or detached earlier via `detachFromChunk`) is
   * moved over in place: it stays spawned throughout, only the chunk it unloads with changes.
   * @param node - The chunk this content belongs to, as received via `chunkLoaded$`'s third tuple element
   * @param entities - The entities to attach
   * @throws if `node` is not currently loaded (never loaded, or already unloaded)
   */
  public attachToChunk(node: MapGraphNodeType, entities: (IEntity & IPositionable3d)[]): void {
    const attached = this.loaded.get(node);
    if (!attached) {
      throw new Error('Cannot attach entities to a chunk that is not currently loaded');
    }
    this.detachFromChunk(entities);
    attached.push(...entities);
    // an entity that is already a child must not go through `addChildren` again: reparenting
    // removes it from the world and spawns it anew
    const newChildren = entities.filter(e => e.parent !== this);
    if (newChildren.length) {
      this.addChildren(...newChildren);
    }
  }

  /**
   * Releases entities from whichever loaded chunk they are attached to, without removing them from
   * the world: they stay spawned, as children of this entity, and no chunk's unload touches them
   * any more. For content that has to outlive the chunk it was spawned with (e.g. a vehicle the
   * player drove away from its home chunk) - hand it back with `attachToChunk` once it should
   * follow a chunk's lifecycle again, or remove it yourself.
   * @param entities - The entities to detach; one not attached to any chunk is skipped
   * @returns The entities that were actually attached to a chunk, and no longer are
   */
  public detachFromChunk(entities: (IEntity & IPositionable3d)[]): (IEntity & IPositionable3d)[] {
    const detached: (IEntity & IPositionable3d)[] = [];
    for (const attached of this.loaded.values()) {
      for (const entity of entities) {
        const index = attached.indexOf(entity);
        if (index >= 0) {
          attached.splice(index, 1);
          detached.push(entity);
        }
      }
    }
    return detached;
  }

  protected disposeChunk(node: MapGraphNodeType) {
    if (!this.loaded.has(node)) {
      return;
    }
    this.removeChildren(this.loaded.get(node)!, true);
    this.loaded.delete(node);
  }
}
