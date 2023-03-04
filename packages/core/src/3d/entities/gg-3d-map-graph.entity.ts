import { BehaviorSubject, NEVER, Observable, startWith, Subject, switchMap } from 'rxjs';
import { distinctUntilChanged, map, tap, throttleTime } from 'rxjs/operators';
import { Point3 } from '../../base/models/points';
import { Graph } from '../../base/data-structures/graph';
import { GgEntity } from '../../base/entities/gg-entity';
import { ITickListener } from '../../base/entities/interfaces/i-tick-listener';
import { GgPositionable3dEntity } from './gg-positionable-3d-entity';
import { Gg3dWorld } from '../gg-3d-world';
import { Gg3dEntity } from './gg-3d-entity';
import { LoadResultWithProps } from '../loader';

type MapGraphNodeType = { path: string, position: Point3 };

export class MapGraph extends Graph<MapGraphNodeType> {
  static fromArray(array: MapGraphNodeType[]): MapGraph {
    const root = new MapGraph(array[0]);
    let tail = root;
    for (let i = 1; i < array.length; i++) {
      const newTail = new MapGraph(array[i]);
      tail.addAdjacent(newTail);
      tail = newTail;
    }
    return root;
  }
  static fromSquareGrid(grid: MapGraphNodeType[][]): MapGraph {
    const nodes = grid.map((sgrid) => sgrid.map(item => new MapGraph(item)));
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
        Math.pow(cursor.x - n.data.position.x, 2)
        + Math.pow(cursor.y - n.data.position.y, 2)
        + Math.pow(cursor.z - n.data.position.z, 2)
      );
      if (dist < min) {
        min = dist
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

export type Gg3dMapGraphEntityOptions = { loadDepth: number };

export class Gg3dMapGraphEntity extends GgEntity implements ITickListener {
  public readonly tick$: Subject<[number, number]> = new Subject<[number, number]>();
  public readonly tickOrder = 1500;

  public readonly loaderCursorEntity$: BehaviorSubject<GgPositionable3dEntity | null> = new BehaviorSubject<GgPositionable3dEntity | null>(null);
  readonly loaded: Map<MapGraphNodeType, GgPositionable3dEntity[]> = new Map();

  private _initialLoadComplete$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
  public get initialLoadComplete$(): Observable<boolean> {
    return this._initialLoadComplete$.asObservable();
  }

  private _nearestDummy$: BehaviorSubject<Graph<MapGraphNodeType> | null> = new BehaviorSubject<Graph<MapGraphNodeType> | null>(null);
  public get nearestDummy(): Graph<MapGraphNodeType> | null {
    return this._nearestDummy$.getValue();
  }
  
  private _chunkLoaded$: Subject<LoadResultWithProps> = new Subject<LoadResultWithProps>();
  public get chunkLoaded$(): Observable<LoadResultWithProps> {
    return this._chunkLoaded$.asObservable();
  }

  get world(): Gg3dWorld | null {
    return this._world;
  }
  protected _world: Gg3dWorld | null = null;
  private readonly mapGraphNodes: MapGraph[];

  constructor(
    public readonly mapGraph: MapGraph,
    protected readonly options: Gg3dMapGraphEntityOptions = { loadDepth: 10 },
  ) {
    super();
    this.mapGraphNodes = mapGraph.nodes();
  }

  onSpawned(world: Gg3dWorld) {
    super.onSpawned(world);
    // TODO takeUntil removed from world?
    this.loaderCursorEntity$.pipe(
      switchMap(entity => entity
        ? this.tick$.pipe(
          startWith(null), // map will perform initial loading even if world not started yet. Handy to preload map
          throttleTime(1000),
          map(() => entity.position)
        )
        : NEVER
      ),
      map((pos) => this.mapGraph.getNearestDummy(this.mapGraphNodes, pos)),
      tap((node) => this._nearestDummy$.next(node)),
      distinctUntilChanged(),
    ).subscribe((currentChunk) => {
      const expectedChunkNames: Set<MapGraphNodeType> = new Set();
      currentChunk.walkRead(this.options.loadDepth).forEach(node => expectedChunkNames.add(node.data));
      for (const loadedNode of this.loaded.keys()) {
        if (!expectedChunkNames.has(loadedNode)) {
          this.disposeChunk(loadedNode);
        } else {
          expectedChunkNames.delete(loadedNode);
        }
      }
      Promise.all(
        Array.from(expectedChunkNames.keys()).map(n => this.loadChunk(n))
      ).then(() => this._initialLoadComplete$.next(true));
    });
  }

  onRemoved() {
    super.onRemoved();
    this.loaderCursorEntity$.next(null);
  }

  protected async loadChunk(node: MapGraphNodeType): Promise<Gg3dEntity[]> {
    // TODO provide all loader options in the node
    const loaded = await this.world!.loader.loadGgGlb(node.path, {
      loadProps: true,
      position: node.position
    });
    const entities = [
      ...loaded.entities,
      ...(loaded.props || [])
        .map(p => p.entities)
        .reduce((p, c) => {
          p.push(...c);
          return p;
        }, [])
    ];
    this.loaded.set(node, entities);
    this.addChildren(...entities);
    this._chunkLoaded$.next(loaded);
    return entities;
  }

  protected disposeChunk(node: MapGraphNodeType) {
    if (!this.loaded.has(node)) {
      return;
    }
    this.removeChildren(this.loaded.get(node)!, true);
    this.loaded.delete(node);
  }
}
