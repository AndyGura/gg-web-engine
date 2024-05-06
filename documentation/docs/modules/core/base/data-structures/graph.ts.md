---
title: core/base/data-structures/graph.ts
nav_order: 71
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

Creates a new Graph instance from an array of elements, where each element in the array is a node in the graph.
The first element of the array is used as the root node of the graph.

**Signature**

```ts
static fromArray<T>(array: T[], closed: boolean = false): Graph<T>
```

### fromSquareGrid (static method)

Creates a new Graph instance from a two-dimensional square grid of elements, where each element in the grid is a node in the graph.
The top-left element of the grid is used as the root node of the graph.
The nodes in the graph are created in the same order as the elements in the grid, from left to right and then from top to bottom.

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
