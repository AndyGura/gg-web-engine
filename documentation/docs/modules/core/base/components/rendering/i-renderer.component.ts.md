---
title: core/base/components/rendering/i-renderer.component.ts
nav_order: 69
parent: Modules
---

## i-renderer.component overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [IRendererComponent (class)](#irenderercomponent-class)
    - [render (method)](#render-method)
    - [addToWorld (method)](#addtoworld-method)
    - [removeFromWorld (method)](#removefromworld-method)
    - [resizeRenderer (method)](#resizerenderer-method)
    - [dispose (method)](#dispose-method)
    - [entity (property)](#entity-property)
    - [rendererOptions (property)](#rendereroptions-property)
  - [RendererOptions (type alias)](#rendereroptions-type-alias)

---

# utils

## IRendererComponent (class)

**Signature**

```ts
export declare class IRendererComponent<D, R, VTypeDoc> {
  protected constructor(
    public readonly scene: IVisualSceneComponent<D, R, VTypeDoc>,
    public readonly canvas?: HTMLCanvasElement,
    options: Partial<RendererOptions & VTypeDoc['rendererExtraOpts']> = {}
  )
}
```

### render (method)

Renders the scene.

**Signature**

```ts
abstract render(): void;
```

### addToWorld (method)

**Signature**

```ts
abstract addToWorld(world: GgWorld<D, R, GgWorldTypeDocVPatch<D, R, VTypeDoc>>): void;
```

### removeFromWorld (method)

**Signature**

```ts
abstract removeFromWorld(world: GgWorld<D, R, GgWorldTypeDocVPatch<D, R, VTypeDoc>>): void;
```

### resizeRenderer (method)

Resizes the renderer to the specified size.

**Signature**

```ts
abstract resizeRenderer(newSize: Point2): void;
```

### dispose (method)

**Signature**

```ts
abstract dispose(): void;
```

### entity (property)

**Signature**

```ts
entity: IEntity<any, any, GgWorldTypeDocRepo<any, any>> | null
```

### rendererOptions (property)

Specifies the options for the renderer.

**Signature**

```ts
readonly rendererOptions: RendererOptions & Partial<VTypeDoc["rendererExtraOpts"]>
```

## RendererOptions (type alias)

Represents the options that can be passed to a renderer.

**Signature**

```ts
export type RendererOptions = {
  transparent: boolean
  background: number
  size: Point2 | 'fullscreen' | ((pageSize: Point2) => Point2) | Observable<Point2>
  forceResolution?: number
  antialias: boolean
}
```
