---
title: three/components/three-renderer.component.ts
nav_order: 130
parent: Modules
---

## three-renderer.component overview

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
    - [world (property)](#world-property)
    - [debugView (property)](#debugview-property)

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
    rendererOptions: Partial<RendererOptions & WebGLRendererParameters> = {}
  )
}
```

### addToWorld (method)

**Signature**

```ts
addToWorld(world: Gg3dWorld<ThreeVisualTypeDocRepo, PhysicsTypeDocRepo3D, ThreeSceneComponent>)
```

### removeFromWorld (method)

**Signature**

```ts
removeFromWorld(world: Gg3dWorld<ThreeVisualTypeDocRepo, PhysicsTypeDocRepo3D, ThreeSceneComponent>)
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

### world (property)

**Signature**

```ts
world: any
```

### debugView (property)

**Signature**

```ts
debugView: ThreePhysicsDebugView | null
```
