---
title: core/base/entities/base-gg-renderer.ts
nav_order: 40
parent: Modules
---

## base-gg-renderer overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [BaseGgRenderer (class)](#baseggrenderer-class)
    - [render (method)](#render-method)
    - [resizeRenderer (method)](#resizerenderer-method)
    - [onSpawned (method)](#onspawned-method)
    - [dispose (method)](#dispose-method)
    - [tickOrder (property)](#tickorder-property)
    - [rendererOptions (property)](#rendereroptions-property)
    - [\_rendererSize$ (property)](#_renderersize-property)
  - [RendererOptions (type alias)](#rendereroptions-type-alias)

---

# utils

## BaseGgRenderer (class)

Represents an abstract base class for a renderer controller.

**Signature**

```ts
export declare class BaseGgRenderer {
  protected constructor(protected readonly canvas?: HTMLCanvasElement, options: Partial<RendererOptions> = {})
}
```

### render (method)

Renders the scene.

**Signature**

```ts
abstract render(): void;
```

### resizeRenderer (method)

Resizes the renderer to the specified size.

**Signature**

```ts
protected abstract resizeRenderer(newSize: Point2): void;
```

### onSpawned (method)

**Signature**

```ts
onSpawned(world: GgWorld<any, any>)
```

### dispose (method)

**Signature**

```ts
dispose()
```

### tickOrder (property)

**Signature**

```ts
readonly tickOrder: GGTickOrder.RENDERING
```

### rendererOptions (property)

Specifies the options for the renderer.

**Signature**

```ts
readonly rendererOptions: RendererOptions
```

### \_rendererSize$ (property)

Represents the current size of the renderer.

**Signature**

```ts
_rendererSize$: any
```

## RendererOptions (type alias)

Represents the options that can be passed to a renderer.

**Signature**

```ts
export type RendererOptions = {
  transparent: boolean
  background: number
  size: Point2 | 'fullscreen' | ((pageSize: Point2) => Point2)
  forceResolution?: number
  antialias: boolean
}
```
