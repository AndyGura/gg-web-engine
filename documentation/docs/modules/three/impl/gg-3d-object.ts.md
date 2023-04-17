---
title: three/impl/gg-3d-object.ts
nav_order: 79
parent: Modules
---

## gg-3d-object overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [Gg3dObject (class)](#gg3dobject-class)
    - [isEmpty (method)](#isempty-method)
    - [popChild (method)](#popchild-method)
    - [getBoundings (method)](#getboundings-method)
    - [clone (method)](#clone-method)
    - [addToWorld (method)](#addtoworld-method)
    - [removeFromWorld (method)](#removefromworld-method)
    - [dispose (method)](#dispose-method)
    - [disposeMesh (method)](#disposemesh-method)
    - [name (property)](#name-property)

---

# utils

## Gg3dObject (class)

**Signature**

```ts
export declare class Gg3dObject {
  constructor(public nativeMesh: Object3D)
}
```

### isEmpty (method)

**Signature**

```ts
public isEmpty(): boolean
```

### popChild (method)

**Signature**

```ts
popChild(name: string): Gg3dObject | null
```

### getBoundings (method)

**Signature**

```ts
getBoundings(): GgBox3d
```

### clone (method)

**Signature**

```ts
clone(): Gg3dObject
```

### addToWorld (method)

**Signature**

```ts
addToWorld(world: Gg3dVisualScene): void
```

### removeFromWorld (method)

**Signature**

```ts
removeFromWorld(world: Gg3dVisualScene): void
```

### dispose (method)

**Signature**

```ts
dispose(): void
```

### disposeMesh (method)

**Signature**

```ts
private disposeMesh(mesh: Mesh)
```

### name (property)

**Signature**

```ts
name: string
```
