---
title: three/impl/gg-renderer.ts
nav_order: 78
parent: Modules
---

## gg-renderer overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [GgRenderer (class)](#ggrenderer-class)
    - [resize (method)](#resize-method)
    - [render (method)](#render-method)
    - [dispose (method)](#dispose-method)
    - [renderer (property)](#renderer-property)

---

# utils

## GgRenderer (class)

**Signature**

```ts
export declare class GgRenderer {
  constructor(
    public readonly canvas?: HTMLCanvasElement,
    rendererOptions: Partial<RendererOptions> = {},
    public camera: ThreeCameraEntity = new ThreeCameraEntity(new ThreeCamera(new PerspectiveCamera(75, 1, 1, 10000)))
  )
}
```

### resize (method)

**Signature**

```ts
resize(newSize: Point2): void
```

### render (method)

**Signature**

```ts
render(): void
```

### dispose (method)

**Signature**

```ts
dispose(): void
```

### renderer (property)

**Signature**

```ts
readonly renderer: any
```
