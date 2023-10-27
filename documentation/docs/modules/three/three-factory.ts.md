---
title: three/three-factory.ts
nav_order: 104
parent: Modules
---

## three-factory overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [ThreeFactory (class)](#threefactory-class)
    - [getRandomMaterial (method)](#getrandommaterial-method)
    - [transformPrimitiveZUp (method)](#transformprimitivezup-method)
    - [createPrimitive (method)](#createprimitive-method)

---

# utils

## ThreeFactory (class)

**Signature**

```ts
export declare class ThreeFactory
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
createPrimitive(
    descriptor: Shape3DDescriptor,
    material: Material = this.getRandomMaterial(),
  ): ThreeDisplayObjectComponent
```
