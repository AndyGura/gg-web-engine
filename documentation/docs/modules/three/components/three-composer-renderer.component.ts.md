---
title: three/components/three-composer-renderer.component.ts
nav_order: 129
parent: Modules
---

## three-composer-renderer.component overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [ThreeComposerRendererComponent (class)](#threecomposerrenderercomponent-class)
    - [addToWorld (method)](#addtoworld-method)
    - [resizeRenderer (method)](#resizerenderer-method)
    - [render (method)](#render-method)
    - [dispose (method)](#dispose-method)
    - [nativeComposer (property)](#nativecomposer-property)

---

# utils

## ThreeComposerRendererComponent (class)

**Signature**

```ts
export declare class ThreeComposerRendererComponent {
  constructor(
    scene: ThreeSceneComponent,
    camera: ThreeCameraComponent,
    canvas?: HTMLCanvasElement,
    rendererOptions: Partial<RendererOptions & WebGLRendererParameters> = {}
  )
}
```

### addToWorld (method)

**Signature**

```ts
addToWorld(world: Gg3dWorld<ThreeVisualTypeDocRepo, PhysicsTypeDocRepo3D, ThreeSceneComponent>)
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

### nativeComposer (property)

**Signature**

```ts
readonly nativeComposer: any
```
