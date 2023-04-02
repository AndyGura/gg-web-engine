---
title: core/2d/interfaces.ts
nav_order: 16
parent: Modules
---

## interfaces overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [Gg2dRenderer (class)](#gg2drenderer-class)
  - [IGg2dBody (interface)](#igg2dbody-interface)
  - [IGg2dObject (interface)](#igg2dobject-interface)
  - [IGg2dPhysicsWorld (interface)](#igg2dphysicsworld-interface)
  - [IGg2dTrigger (interface)](#igg2dtrigger-interface)
  - [IGg2dVisualScene (interface)](#igg2dvisualscene-interface)

---

# utils

## Gg2dRenderer (class)

**Signature**

```ts
export declare class Gg2dRenderer
```

## IGg2dBody (interface)

**Signature**

```ts
export interface IGg2dBody extends GgBody<Point2, number> {}
```

## IGg2dObject (interface)

**Signature**

```ts
export interface IGg2dObject extends GgObject<Point2, number> {}
```

## IGg2dPhysicsWorld (interface)

**Signature**

```ts
export interface IGg2dPhysicsWorld extends GgPhysicsWorld<Point2, number> {
  readonly factory: IGg2dBodyFactory
}
```

## IGg2dTrigger (interface)

**Signature**

```ts
export interface IGg2dTrigger extends GgTrigger<Point2, number> {
```

## IGg2dVisualScene (interface)

**Signature**

```ts
export interface IGg2dVisualScene extends GgVisualScene<Point2, number> {
  readonly factory: IGg2dObjectFactory
}
```
