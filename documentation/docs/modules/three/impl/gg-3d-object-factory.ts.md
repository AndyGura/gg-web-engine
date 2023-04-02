---
title: three/impl/gg-3d-object-factory.ts
nav_order: 78
parent: Modules
---

## gg-3d-object-factory overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [Gg3dObjectFactory (class)](#gg3dobjectfactory-class)
    - [getRandomMaterial (method)](#getrandommaterial-method)
    - [transformPrimitiveZUp (method)](#transformprimitivezup-method)
    - [createPrimitive (method)](#createprimitive-method)

---

# utils

## Gg3dObjectFactory (class)

**Signature**

```ts
export declare class Gg3dObjectFactory
```

### getRandomMaterial (method)

**Signature**

```ts
getRandomMaterial(): Material
```

### transformPrimitiveZUp (method)

**Signature**

```ts
private transformPrimitiveZUp(object: Object3D): Group
```

### createPrimitive (method)

**Signature**

```ts
createPrimitive(descriptor: Shape3DDescriptor, material: Material = this.getRandomMaterial()): Gg3dObject
```
