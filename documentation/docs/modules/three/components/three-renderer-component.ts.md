---
title: three/components/three-renderer-component.ts
nav_order: 125
parent: Modules
---

## three-renderer-component overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [ThreeRendererComponent (class)](#threerenderercomponent-class)
    - [addToWorld (method)](#addtoworld-method)
    - [removeFromWorld (method)](#removefromworld-method)
    - [resizeRenderer (method)](#resizerenderer-method)
    - [render (method)](#render-method)
    - [dispose (method)](#dispose-method)
    - [nativeRenderer (property)](#nativerenderer-property)

---

# utils

## ThreeRendererComponent (class)

**Signature**

```ts
export declare class ThreeRendererComponent {
  constructor(
    public readonly scene: ThreeSceneComponent,
    public camera: ThreeCameraComponent,
    public readonly canvas?: HTMLCanvasElement,
    rendererOptions: Partial<RendererOptions> = {}
  )
}
```

### addToWorld (method)

**Signature**

```ts
addToWorld(world: Gg3dWorld<ThreeVisualTypeDocRepo>)
```

### removeFromWorld (method)

**Signature**

```ts
removeFromWorld(world: Gg3dWorld<ThreeVisualTypeDocRepo>)
```

### resizeRenderer (method)

**Signature**

```ts
resizeRenderer(newSize: Point2): void
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

### nativeRenderer (property)

**Signature**

```ts
readonly nativeRenderer: any
```
