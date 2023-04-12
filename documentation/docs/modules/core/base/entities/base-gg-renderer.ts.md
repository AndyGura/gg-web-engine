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
    - [resize (method)](#resize-method)
    - [onSpawned (method)](#onspawned-method)
    - [onRemoved (method)](#onremoved-method)
    - [tickOrder (property)](#tickorder-property)
    - [rendererOptions (property)](#rendereroptions-property)
  - [RendererOptions (type alias)](#rendereroptions-type-alias)

---

# utils

## BaseGgRenderer (class)

**Signature**

```ts
export declare class BaseGgRenderer {
  protected constructor(protected readonly canvas?: HTMLCanvasElement, options: Partial<RendererOptions> = {})
}
```

### render (method)

**Signature**

```ts
abstract render(): void;
```

### resize (method)

**Signature**

```ts
abstract resize(newSize: Point2): void;
```

### onSpawned (method)

**Signature**

```ts
onSpawned(world: GgWorld<any, any>)
```

### onRemoved (method)

**Signature**

```ts
onRemoved()
```

### tickOrder (property)

**Signature**

```ts
readonly tickOrder: GGTickOrder.RENDERING
```

### rendererOptions (property)

**Signature**

```ts
readonly rendererOptions: RendererOptions
```

## RendererOptions (type alias)

**Signature**

```ts
export type RendererOptions = {
  transparent: boolean
  background: number
  forceRendererSize?: Point2
  forceResolution?: number
  antialias: boolean
}
```
