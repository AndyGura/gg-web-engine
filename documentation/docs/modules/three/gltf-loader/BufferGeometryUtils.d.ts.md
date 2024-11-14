---
title: three/gltf-loader/BufferGeometryUtils.d.ts
nav_order: 132
parent: Modules
---

## BufferGeometryUtils.d overview

// https://threejs.org/docs/?q=buffergeome#examples/en/utils/BufferGeometryUtils

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [computeMikkTSpaceTangents](#computemikktspacetangents)
  - [computeMorphedAttributes](#computemorphedattributes)
  - [deepCloneAttribute](#deepcloneattribute)
  - [deinterleaveAttribute](#deinterleaveattribute)
  - [deinterleaveGeometry](#deinterleavegeometry)
  - [estimateBytesUsed](#estimatebytesused)
  - [interleaveAttributes](#interleaveattributes)
  - [mergeAttributes](#mergeattributes)
  - [mergeGeometries](#mergegeometries)
  - [mergeGroups](#mergegroups)
  - [mergeVertices](#mergevertices)
  - [toCreasedNormals](#tocreasednormals)
  - [toTrianglesDrawMode](#totrianglesdrawmode)

---

# utils

## computeMikkTSpaceTangents

**Signature**

```ts
export declare function computeMikkTSpaceTangents(
  geometry: BufferGeometry,
  MikkTSpace: unknown,
  negateSign?: boolean
): BufferGeometry
```

## computeMorphedAttributes

**Signature**

```ts
export declare function computeMorphedAttributes(object: Mesh | Line | Points): object
```

## deepCloneAttribute

**Signature**

```ts
export declare function deepCloneAttribute(attribute: BufferAttribute): BufferAttribute
```

## deinterleaveAttribute

**Signature**

```ts
export declare function deinterleaveAttribute(geometry: BufferGeometry): void
```

## deinterleaveGeometry

**Signature**

```ts
export declare function deinterleaveGeometry(geometry: BufferGeometry): void
```

## estimateBytesUsed

**Signature**

```ts
export declare function estimateBytesUsed(geometry: BufferGeometry): number
```

## interleaveAttributes

**Signature**

```ts
export declare function interleaveAttributes(attributes: BufferAttribute[]): InterleavedBufferAttribute
```

## mergeAttributes

**Signature**

```ts
export declare function mergeAttributes(attributes: BufferAttribute[]): BufferAttribute
```

## mergeGeometries

**Signature**

```ts
export declare function mergeGeometries(geometries: BufferGeometry[], useGroups?: boolean): BufferGeometry
```

## mergeGroups

**Signature**

```ts
export declare function mergeGroups(geometry: BufferGeometry): BufferGeometry
```

## mergeVertices

**Signature**

```ts
export declare function mergeVertices(geometry: BufferGeometry, tolerance?: number): BufferGeometry
```

## toCreasedNormals

Modifies the supplied geometry if it is non-indexed, otherwise creates a new, non-indexed geometry. Returns the
geometry with smooth normals everywhere except faces that meet at an angle greater than the crease angle.

**Signature**

```ts
export declare function toCreasedNormals(geometry: BufferGeometry, creaseAngle?: number): BufferGeometry
```

## toTrianglesDrawMode

**Signature**

```ts
export declare function toTrianglesDrawMode(geometry: BufferGeometry, drawMode: TrianglesDrawModes): BufferGeometry
```
