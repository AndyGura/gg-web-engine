---
title: core/base/components/rendering/i-renderer.component.ts
nav_order: 67
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
export declare class IRendererComponent<D, R, VS> {
  protected constructor(
    public readonly scene: VS,
    public readonly canvas?: HTMLCanvasElement,
    options: Partial<RendererOptions> = {}
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
abstract addToWorld(world: GgWorld<D, R, VS, any>): void;
```

### removeFromWorld (method)

**Signature**

```ts
abstract removeFromWorld(world: GgWorld<D, R, VS, any>): void;
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
entity: IEntity<any, any, IVisualSceneComponent<any, any>, IPhysicsWorldComponent<any, any>> | null
```

### rendererOptions (property)

Specifies the options for the renderer.

**Signature**

```ts
readonly rendererOptions: RendererOptions
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
