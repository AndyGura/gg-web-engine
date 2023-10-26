---
title: pixi/components/pixi-renderer.component.ts
nav_order: 97
parent: Modules
---

## pixi-renderer.component overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [PixiRendererComponent (class)](#pixirenderercomponent-class)
    - [resizeRenderer (method)](#resizerenderer-method)
    - [addToWorld (method)](#addtoworld-method)
    - [removeFromWorld (method)](#removefromworld-method)
    - [render (method)](#render-method)
    - [dispose (method)](#dispose-method)
    - [application (property)](#application-property)

---

# utils

## PixiRendererComponent (class)

**Signature**

```ts
export declare class PixiRendererComponent {
  constructor(
    public readonly scene: PixiSceneComponent,
    public readonly canvas?: HTMLCanvasElement,
    options: Partial<RendererOptions> = {}
  )
}
```

### resizeRenderer (method)

**Signature**

```ts
resizeRenderer(newSize: Point2): void
```

### addToWorld (method)

**Signature**

```ts
addToWorld(world: Gg2dWorld<PixiSceneComponent>): void
```

### removeFromWorld (method)

**Signature**

```ts
removeFromWorld(world: Gg2dWorld<PixiSceneComponent>): void
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
