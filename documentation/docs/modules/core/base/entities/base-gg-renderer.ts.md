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
    - [activate (method)](#activate-method)
    - [deactivate (method)](#deactivate-method)
    - [init (method)](#init-method)
    - [render (method)](#render-method)
    - [resize (method)](#resize-method)
    - [dispose (method)](#dispose-method)
    - [\_permanentRenderMethods (property)](#_permanentrendermethods-property)
    - [\_singularRenderMethods (property)](#_singularrendermethods-property)
    - [tick$ (property)](#tick-property)
    - [tickOrder (property)](#tickorder-property)
    - [tickListener (property)](#ticklistener-property)
    - [rendererOptions (property)](#rendereroptions-property)
  - [RendererOptions (type alias)](#rendereroptions-type-alias)

---

# utils

## BaseGgRenderer (class)

**Signature**

```ts
export declare class BaseGgRenderer {
  protected constructor(canvas?: HTMLCanvasElement, options: Partial<RendererOptions> = {})
}
```

### activate (method)

**Signature**

```ts
public activate(): void
```

### deactivate (method)

**Signature**

```ts
public deactivate(): void
```

### init (method)

**Signature**

```ts
init(): void
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

### dispose (method)

**Signature**

```ts
abstract dispose(): void;
```

### \_permanentRenderMethods (property)

**Signature**

```ts
_permanentRenderMethods: any
```

### \_singularRenderMethods (property)

**Signature**

```ts
_singularRenderMethods: any
```

### tick$ (property)

**Signature**

```ts
readonly tick$: any
```

### tickOrder (property)

**Signature**

```ts
readonly tickOrder: 1000
```

### tickListener (property)

**Signature**

```ts
tickListener: any
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
