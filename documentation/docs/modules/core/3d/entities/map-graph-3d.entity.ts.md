---
title: core/3d/entities/map-graph-3d.entity.ts
nav_order: 84
parent: Modules
---

## map-graph-3d.entity overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [Gg3dMapGraphEntityOptions (type alias)](#gg3dmapgraphentityoptions-type-alias)
  - [MapGraph (class)](#mapgraph-class)
    - [fromMapArray (static method)](#frommaparray-static-method)
    - [fromMapSquareGrid (static method)](#frommapsquaregrid-static-method)
    - [getNearestDummy (method)](#getnearestdummy-method)
    - [nodes (method)](#nodes-method)
  - [MapGraph3dEntity (class)](#mapgraph3dentity-class)
    - [onSpawned (method)](#onspawned-method)
    - [onRemoved (method)](#onremoved-method)
    - [loadChunk (method)](#loadchunk-method)
    - [attachToChunk (method)](#attachtochunk-method)
    - [detachFromChunk (method)](#detachfromchunk-method)
    - [holdChunkAssets (method)](#holdchunkassets-method)
    - [dispose (method)](#dispose-method)
    - [disposeChunk (method)](#disposechunk-method)
    - [tickOrder (property)](#tickorder-property)
    - [loaderCursor$ (property)](#loadercursor-property)
    - [loaded (property)](#loaded-property)
    - [\_chunkLoaded$ (property)](#_chunkloaded-property)
    - [mapGraphNodes (property)](#mapgraphnodes-property)
    - [options (property)](#options-property)
    - [loadClock (property)](#loadclock-property)
    - [override (property)](#override-property)
  - [MapGraphNodeType (type alias)](#mapgraphnodetype-type-alias)

---

# utils

## Gg3dMapGraphEntityOptions (type alias)

**Signature**

```ts
export type Gg3dMapGraphEntityOptions = {
  // depth in tree to load. 0 means load only the nearest node, 1 means nearest + all of it's neighbours etc.
  loadDepth: number
  // additional depth, means unload delay. Nodes with this depth won't load, but if already loaded, will not be destroyed
  inertia: number
  // max amount of nodes that can be loaded on single tick. Use this to avoid framerate drop when loading multiple heavy nodes at once
  maxNodesLoadingPerTick: number
}
```

## MapGraph (class)

**Signature**

```ts
export declare class MapGraph
```

### fromMapArray (static method)

Creates a new MapGraph instance from an array of elements, where each element in the array is a node in the graph.
The first element of the array is used as the root node of the graph.

**Signature**

```ts
static fromMapArray(array: MapGraphNodeType[], closed: boolean = false): MapGraph
```

### fromMapSquareGrid (static method)

Creates a new MapGraph instance from a two-dimensional square grid of elements, where each element in the grid is a node in the graph.
The top-left element of the grid is used as the root node of the graph.
The nodes in the graph are created in the same order as the elements in the grid, from left to right and then from top to bottom.

**Signature**

```ts
static fromMapSquareGrid(grid: MapGraphNodeType[][]): MapGraph
```

### getNearestDummy (method)

**Signature**

```ts
public getNearestDummy(thisNodes: Graph<MapGraphNodeType>[], cursor: Point3): Graph<MapGraphNodeType>
```

### nodes (method)

**Signature**

```ts
nodes(): MapGraph[]
```

## MapGraph3dEntity (class)

**Signature**

```ts
export declare class MapGraph3dEntity<TypeDoc> {
  constructor(public readonly mapGraph: MapGraph, options: Partial<Gg3dMapGraphEntityOptions> = {})
}
```

### onSpawned (method)

**Signature**

```ts
onSpawned(world: Gg3dWorld<TypeDoc>)
```

### onRemoved (method)

**Signature**

```ts
onRemoved()
```

### loadChunk (method)

**Signature**

```ts
protected async loadChunk(node: MapGraphNodeType): Promise<[Entity3d<TypeDoc>[], LoadResultWithProps<TypeDoc>]>
```

### attachToChunk (method)

Attaches already-constructed entities to an already-loaded chunk's own lifecycle: added as
children now (same as the chunk's own GLB-loaded entities), and automatically removed/disposed
the next time that chunk unloads. For content spawned in reaction to `chunkLoaded$` that isn't
itself part of the chunk's GLB (e.g. traffic placed per-chunk by app code) - without this, such
content has no lifecycle tied to the chunk at all, and leaks (and, if it reuses names on a later
reload while the leaked copy is still around, collides with them) once the chunk unloads.

**Signature**

```ts
public attachToChunk(node: MapGraphNodeType, entities: (IEntity & IPositionable3d)[]): void
```

### detachFromChunk (method)

Releases entities from whichever loaded chunk they are attached to, without removing them from
the world: they stay spawned, as children of this entity, and no chunk's unload touches them
any more. For content that has to outlive the chunk it was spawned with (e.g. a vehicle the
player drove away from its home chunk) - hand it back with `attachToChunk` once it should
follow a chunk's lifecycle again, or remove it yourself. An entity the chunk loaded itself
shares the chunk's cached geometry, materials and shapes: it keeps them alive on its own from
here on, until it is disposed, so the chunk unloading doesn't free them under it.

**Signature**

```ts
public detachFromChunk(entities: (IEntity & IPositionable3d)[]): (IEntity & IPositionable3d)[]
```

### holdChunkAssets (method)

Lets an entity a chunk loaded keep that chunk's assets after leaving it, until disposed.

**Signature**

```ts
private holdChunkAssets(entity: IEntity): void
```

### dispose (method)

**Signature**

```ts
dispose(): void
```

### disposeChunk (method)

**Signature**

```ts
protected disposeChunk(node: MapGraphNodeType)
```

### tickOrder (property)

**Signature**

```ts
readonly tickOrder: TickOrder.POST_RENDERING
```

### loaderCursor$ (property)

**Signature**

```ts
readonly loaderCursor$: any
```

### loaded (property)

**Signature**

```ts
readonly loaded: Map<MapGraphNodeType, (IEntity<any, any, GgWorldTypeDocRepo<any, any>> & IPositionable3d)[]>
```

### \_chunkLoaded$ (property)

**Signature**

```ts
_chunkLoaded$: any
```

### mapGraphNodes (property)

**Signature**

```ts
readonly mapGraphNodes: MapGraph[]
```

### options (property)

**Signature**

```ts
readonly options: Gg3dMapGraphEntityOptions
```

### loadClock (property)

**Signature**

```ts
loadClock: PausableClock | null
```

### override (property)

**Signature**

```ts
override: any
```

## MapGraphNodeType (type alias)

**Signature**

```ts
export type MapGraphNodeType = {
  path: string
  position: Point3
  rotation?: Point4
  loadOptions: Partial<Omit<LoadOptions, 'position' | 'rotation'>>
}
```
