import { BehaviorSubject, NEVER, Observable, startWith, Subject, switchMap, takeUntil } from 'rxjs';
import { distinctUntilChanged, map, tap, throttleTime } from 'rxjs/operators';
import { Graph, IEntity, Point3, Point4, Qtrn, TickOrder } from '../../base';
import { Gg3dWorld, PhysicsTypeDocRepo3D, VisualTypeDocRepo3D } from '../gg-3d-world';
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
};

const defaultOptions: Gg3dMapGraphEntityOptions = {
  loadDepth: 5,
  inertia: 0,
};

export class MapGraph3dEntity<
  VTypeDoc extends VisualTypeDocRepo3D = VisualTypeDocRepo3D,
  PTypeDoc extends PhysicsTypeDocRepo3D = PhysicsTypeDocRepo3D,
> extends IRenderable3dEntity<VTypeDoc, PTypeDoc> {
  public readonly tickOrder = TickOrder.POST_RENDERING;

  public readonly loaderCursorEntity$: BehaviorSubject<(IEntity & IPositionable3d) | null> = new BehaviorSubject<
    (IEntity & IPositionable3d) | null
  >(null);
  readonly loaded: Map<MapGraphNodeType, (IEntity & IPositionable3d)[]> = new Map();

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
      LoadResultWithProps<VTypeDoc, PTypeDoc>,
      {
        position: Point3;
        rotation: Point4;
      },
    ]
  > = new Subject<[LoadResultWithProps<VTypeDoc, PTypeDoc>, { position: Point3; rotation: Point4 }]>();
  public get chunkLoaded$(): Observable<
    [
      LoadResultWithProps<VTypeDoc, PTypeDoc>,
      {
        position: Point3;
        rotation: Point4;
      },
    ]
  > {
    return this._chunkLoaded$.asObservable();
  }

  get world(): Gg3dWorld<VTypeDoc, PTypeDoc> | null {
    return this._world;
  }

  protected _world: Gg3dWorld<VTypeDoc, PTypeDoc> | null = null;
  protected readonly mapGraphNodes: MapGraph[];

  protected readonly options: Gg3dMapGraphEntityOptions;

  constructor(public readonly mapGraph: MapGraph, options: Partial<Gg3dMapGraphEntityOptions> = {}) {
    super();
    this.options = { ...defaultOptions, ...options };
    this.mapGraphNodes = mapGraph.nodes();
  }

  onSpawned(world: Gg3dWorld<VTypeDoc, PTypeDoc>) {
    super.onSpawned(world);
    this.loaderCursorEntity$
      .pipe(
        takeUntil(this._onRemoved$),
        switchMap(entity =>
          entity
            ? this.tick$.pipe(
                startWith(null), // map will perform initial loading even if world not started yet. Handy to preload map
                takeUntil(entity.onRemoved$),
                throttleTime(1000),
                map(() => entity.position),
              )
            : NEVER,
        ),
        map(pos => this.mapGraph.getNearestDummy(this.mapGraphNodes, pos)),
        tap(node => this._nearestDummy$.next(node)),
        distinctUntilChanged(),
      )
      .subscribe(currentChunk => {
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
        for (const loadedNode of this.loaded.keys()) {
          if (!canBeLoaded.has(loadedNode)) {
            this.disposeChunk(loadedNode);
          } else {
            haveToBeLoaded.delete(loadedNode);
          }
        }
        Promise.all(Array.from(haveToBeLoaded.keys()).map(n => this.loadChunk(n))).then(() =>
          this._initialLoadComplete$.next(true),
        );
      });
  }

  onRemoved() {
    super.onRemoved();
    this.loaderCursorEntity$.next(null);
  }

  protected async loadChunk(
    node: MapGraphNodeType,
  ): Promise<[Entity3d<VTypeDoc, PTypeDoc>[], LoadResultWithProps<VTypeDoc, PTypeDoc>]> {
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
    this._chunkLoaded$.next([loaded, { position: node.position, rotation: node.rotation || Qtrn.O }]);
    return [entities, loaded];
  }

  protected disposeChunk(node: MapGraphNodeType) {
    if (!this.loaded.has(node)) {
      return;
    }
    this.removeChildren(this.loaded.get(node)!, true);
    this.loaded.delete(node);
  }
}
