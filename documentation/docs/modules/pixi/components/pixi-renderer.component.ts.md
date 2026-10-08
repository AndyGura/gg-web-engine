---
title: pixi/components/pixi-renderer.component.ts
nav_order: 188
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
    - [applyBackground (method)](#applybackground-method)
    - [setClearColor (method)](#setclearcolor-method)
    - [dispose (method)](#dispose-method)
    - [application (property)](#application-property)
    - [world (property)](#world-property)

---

# utils

## PixiRendererComponent (class)

**Signature**

```ts
export declare class PixiRendererComponent {
  constructor(
    public readonly scene: PixiSceneComponent,
    public camera: PixiCameraComponent,
    public readonly canvas?: HTMLCanvasElement,
    options: Partial<RendererOptions & ApplicationOptions> = {}
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
addToWorld(world: PixiGgWorld): void
```

### removeFromWorld (method)

**Signature**

```ts
removeFromWorld(world: PixiGgWorld, dispose?: boolean): void
```

### render (method)

**Signature**

```ts
render(): void
```

### applyBackground (method)

Shows the scene's `environment.background`: a color becomes the renderer's clear color, a
texture a sprite behind the world container scaled to cover the whole canvas. Without one the
renderer keeps the clear color it was created with.

**Signature**

```ts
private applyBackground(width: number, height: number): void
```

### setClearColor (method)

Overrides the renderer's clear color with `color`, or with `null` puts back the one the
renderer was created with. The alpha the renderer was created with is kept either way.

**Signature**

```ts
private setClearColor(color: number | null): void
```

### dispose (method)

**Signature**

```ts
dispose(): void
```

### application (property)

**Signature**

```ts
readonly application: Application<Renderer<HTMLCanvasElement>>
```

### world (property)

**Signature**

```ts
world: PixiGgWorld | null
```
