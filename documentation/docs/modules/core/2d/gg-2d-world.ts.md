---
title: core/2d/gg-2d-world.ts
nav_order: 23
parent: Modules
---

## gg-2d-world overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [Gg2dWorld (class)](#gg2dworld-class)
    - [addPrimitiveRigidBody (method)](#addprimitiverigidbody-method)
    - [addRenderer (method)](#addrenderer-method)
  - [PhysicsTypeDocRepo2D (type alias)](#physicstypedocrepo2d-type-alias)
  - [VisualTypeDocRepo2D (type alias)](#visualtypedocrepo2d-type-alias)

---

# utils

## Gg2dWorld (class)

**Signature**

```ts
export declare class Gg2dWorld<VTypeDoc, PTypeDoc, VS, PW> {
  constructor(public readonly visualScene: VS, public readonly physicsWorld: PW)
}
```

### addPrimitiveRigidBody (method)

**Signature**

```ts
addPrimitiveRigidBody(
    descr: BodyShape2DDescriptor,
    position: Point2 = Pnt2.O,
    rotation: number = 0,
    material: DisplayObject2dOpts<VTypeDoc['texture']> = {},
  ): Entity2d<VTypeDoc, PTypeDoc>
```

### addRenderer (method)

**Signature**

```ts
addRenderer(
    canvas?: HTMLCanvasElement,
    rendererOptions?: Partial<RendererOptions & VTypeDoc['rendererExtraOpts']>,
  ): Renderer2dEntity<VTypeDoc>
```

## PhysicsTypeDocRepo2D (type alias)

**Signature**

```ts
export type PhysicsTypeDocRepo2D = {
  factory: IPhysicsBody2dComponentFactory
  rigidBody: IRigidBody2dComponent
  trigger: ITrigger2dComponent
}
```

## VisualTypeDocRepo2D (type alias)

**Signature**

```ts
export type VisualTypeDocRepo2D = {
  factory: IDisplayObject2dComponentFactory
  displayObject: IDisplayObject2dComponent
  renderer: IRenderer2dComponent
  rendererExtraOpts: {}
  texture: unknown
}
```
