---
title: core/3d/entities/map-graph-3d.entity.ts
nav_order: 44
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
    - [disposeChunk (method)](#disposechunk-method)
    - [tickOrder (property)](#tickorder-property)
    - [loaderCursorEntity$ (property)](#loadercursorentity-property)
    - [loaded (property)](#loaded-property)
    - [\_chunkLoaded$ (property)](#_chunkloaded-property)
    - [\_world (property)](#_world-property)
    - [mapGraphNodes (property)](#mapgraphnodes-property)
    - [options (property)](#options-property)
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
export declare class MapGraph3dEntity {
  constructor(public readonly mapGraph: MapGraph, options: Partial<Gg3dMapGraphEntityOptions> = {})
}
```

### onSpawned (method)

**Signature**

```ts
onSpawned(world: Gg3dWorld)
```

### onRemoved (method)

**Signature**

```ts
onRemoved()
```

### loadChunk (method)

**Signature**

```ts
protected async loadChunk(node: MapGraphNodeType): Promise<[Entity3d[], LoadResultWithProps]>
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

### loaderCursorEntity$ (property)

**Signature**

```ts
readonly loaderCursorEntity$: any
```

### loaded (property)

**Signature**

```ts
readonly loaded: any
```

### \_chunkLoaded$ (property)

**Signature**

```ts
_chunkLoaded$: any
```

### \_world (property)

**Signature**

```ts
_world: Gg3dWorld<IVisualScene3dComponent, IPhysicsWorld3dComponent> | null
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
