---
title: core/base/data-structures/graph.ts
nav_order: 42
parent: Modules
---

## graph overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [Graph (class)](#graph-class)
    - [fromArray (static method)](#fromarray-static-method)
    - [fromSquareGrid (static method)](#fromsquaregrid-static-method)
    - [addAdjacent (method)](#addadjacent-method)
    - [removeAdjacent (method)](#removeadjacent-method)
    - [addEdge (method)](#addedge-method)
    - [removeEdge (method)](#removeedge-method)
    - [walkRead (method)](#walkread-method)
    - [walkReadPreserveDepth (method)](#walkreadpreservedepth-method)
    - [nodes (method)](#nodes-method)
    - [data (property)](#data-property)

---

# utils

## Graph (class)

**Signature**

```ts
export declare class Graph<T> {
  constructor(data: T)
}
```

### fromArray (static method)

**Signature**

```ts
static fromArray<T>(array: T[]): Graph<T>
```

### fromSquareGrid (static method)

**Signature**

```ts
static fromSquareGrid<T>(grid: T[][]): Graph<T>
```

### addAdjacent (method)

**Signature**

```ts
addAdjacent(node: Graph<T>): boolean
```

### removeAdjacent (method)

**Signature**

```ts
removeAdjacent(node: Graph<T>): boolean
```

### addEdge (method)

Create an edge between two nodes

**Signature**

```ts
addEdge(source: Graph<T>, destination: Graph<T>): boolean
```

### removeEdge (method)

Remove an edge between two nodes

**Signature**

```ts
removeEdge(source: Graph<T>, destination: Graph<T>): boolean
```

### walkRead (method)

**Signature**

```ts
walkRead(depth: number): Set<Graph<T>>
```

### walkReadPreserveDepth (method)

**Signature**

```ts
walkReadPreserveDepth(depth: number): Set<Graph<T>>[]
```

### nodes (method)

**Signature**

```ts
nodes(): Graph<T>[]
```

### data (property)

**Signature**

```ts
data: T
```
