---
title: core/3d/entities/gg-3d-map-graph.entity.ts
nav_order: 23
parent: Modules
---

## gg-3d-map-graph.entity overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [Gg3dMapGraphEntity (class)](#gg3dmapgraphentity-class)
    - [onSpawned (method)](#onspawned-method)
    - [onRemoved (method)](#onremoved-method)
    - [loadChunk (method)](#loadchunk-method)
    - [disposeChunk (method)](#disposechunk-method)
    - [tick$ (property)](#tick-property)
    - [tickOrder (property)](#tickorder-property)
    - [loaderCursorEntity$ (property)](#loadercursorentity-property)
    - [loaded (property)](#loaded-property)
    - [\_world (property)](#_world-property)
    - [options (property)](#options-property)
  - [Gg3dMapGraphEntityOptions (type alias)](#gg3dmapgraphentityoptions-type-alias)
  - [MapGraph (class)](#mapgraph-class)
    - [fromMapArray (static method)](#frommaparray-static-method)
    - [fromMapSquareGrid (static method)](#frommapsquaregrid-static-method)
    - [getNearestDummy (method)](#getnearestdummy-method)
    - [nodes (method)](#nodes-method)

---

# utils

## Gg3dMapGraphEntity (class)

**Signature**

```ts
export declare class Gg3dMapGraphEntity {
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
protected async loadChunk(node: MapGraphNodeType): Promise<Gg3dEntity[]>
```

### disposeChunk (method)

**Signature**

```ts
protected disposeChunk(node: MapGraphNodeType)
```

### tick$ (property)

**Signature**

```ts
readonly tick$: any
```

### tickOrder (property)

**Signature**

```ts
readonly tickOrder: 1500
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

### \_world (property)

**Signature**

```ts
_world: Gg3dWorld<IGg3dVisualScene, IGg3dPhysicsWorld> | null
```

### options (property)

**Signature**

```ts
readonly options: Gg3dMapGraphEntityOptions
```

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

**Signature**

```ts
static fromMapArray(array: MapGraphNodeType[]): MapGraph
```

### fromMapSquareGrid (static method)

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
