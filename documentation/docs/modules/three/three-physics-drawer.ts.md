---
title: three/three-physics-drawer.ts
nav_order: 85
parent: Modules
---

## three-physics-drawer overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [ThreePhysicsDrawer (class)](#threephysicsdrawer-class)
    - [drawContactPoint (method)](#drawcontactpoint-method)
    - [drawLine (method)](#drawline-method)
    - [update (method)](#update-method)
    - [setXYZ (method)](#setxyz-method)
    - [debugBufferSize (property)](#debugbuffersize-property)
    - [debugVertices (property)](#debugvertices-property)
    - [debugColors (property)](#debugcolors-property)

---

# utils

## ThreePhysicsDrawer (class)

**Signature**

```ts
export declare class ThreePhysicsDrawer {
  constructor()
}
```

### drawContactPoint (method)

**Signature**

```ts
drawContactPoint(point: Point3, normal: Point3, color?: Point3): void
```

### drawLine (method)

**Signature**

```ts
drawLine(from: Point3, to: Point3, color?: Point3): void
```

### update (method)

**Signature**

```ts
update()
```

### setXYZ (method)

**Signature**

```ts
private setXYZ(array: Float32Array, index: number, x: number, y: number, z: number)
```

### debugBufferSize (property)

**Signature**

```ts
readonly debugBufferSize: number
```

### debugVertices (property)

**Signature**

```ts
readonly debugVertices: Float32Array
```

### debugColors (property)

**Signature**

```ts
readonly debugColors: Float32Array
```
