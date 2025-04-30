---
title: three/three-factory.ts
nav_order: 134
parent: Modules
---

## three-factory overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [ThreeDisplayObject3dOpts (type alias)](#threedisplayobject3dopts-type-alias)
  - [ThreeFactory (class)](#threefactory-class)
    - [createMaterial (method)](#creatematerial-method)
    - [transformPrimitiveZUp (method)](#transformprimitivezup-method)
    - [createPrimitive (method)](#createprimitive-method)
    - [createPerspectiveCamera (method)](#createperspectivecamera-method)

---

# utils

## ThreeDisplayObject3dOpts (type alias)

**Signature**

```ts
export type ThreeDisplayObject3dOpts = DisplayObject3dOpts<Texture>
```

## ThreeFactory (class)

**Signature**

```ts
export declare class ThreeFactory
```

### createMaterial (method)

**Signature**

```ts
createMaterial(descr: ThreeDisplayObject3dOpts): Material
```

### transformPrimitiveZUp (method)

**Signature**

```ts
private transformPrimitiveZUp(object: Mesh): void
```

### createPrimitive (method)

**Signature**

```ts
createPrimitive(
    descriptor: Shape3DMeshDescriptor,
    material: ThreeDisplayObject3dOpts = {},
  ): ThreeDisplayObjectComponent
```

### createPerspectiveCamera (method)

**Signature**

```ts
createPerspectiveCamera(
    settings: {
      fov?: number;
      aspectRatio?: number;
      frustrum?: { near: number; far: number };
    } = {},
  ): ThreeCameraComponent
```
