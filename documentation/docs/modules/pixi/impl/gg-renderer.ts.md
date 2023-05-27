---
title: pixi/impl/gg-renderer.ts
nav_order: 77
parent: Modules
---

## gg-renderer overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [GgRenderer (class)](#ggrenderer-class)
    - [resizeRenderer (method)](#resizerenderer-method)
    - [onSpawned (method)](#onspawned-method)
    - [onRemoved (method)](#onremoved-method)
    - [render (method)](#render-method)
    - [dispose (method)](#dispose-method)
    - [application (property)](#application-property)

---

# utils

## GgRenderer (class)

**Signature**

```ts
export declare class GgRenderer {
  constructor(canvas?: HTMLCanvasElement, rendererOptions: Partial<RendererOptions> = {})
}
```

### resizeRenderer (method)

**Signature**

```ts
resizeRenderer(newSize: Point2): void
```

### onSpawned (method)

**Signature**

```ts
public onSpawned(world: Gg2dWorld)
```

### onRemoved (method)

**Signature**

```ts
public onRemoved()
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

### application (property)

**Signature**

```ts
readonly application: any
```
