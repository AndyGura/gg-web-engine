---
title: three/components/three-physics-debug-view.ts
nav_order: 130
parent: Modules
---

## three-physics-debug-view overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [ThreePhysicsDebugView (class)](#threephysicsdebugview-class)
    - [startDebugView (static method)](#startdebugview-static-method)
    - [stopDebugView (static method)](#stopdebugview-static-method)
    - [render (method)](#render-method)
    - [lineSegmentPointsForShape (method)](#linesegmentpointsforshape-method)
    - [dispose (method)](#dispose-method)

---

# utils

## ThreePhysicsDebugView (class)

**Signature**

```ts
export declare class ThreePhysicsDebugView {
  private constructor(private readonly world: Gg3dWorld<ThreeVisualTypeDocRepo>)
}
```

### startDebugView (static method)

**Signature**

```ts
public static startDebugView(
    world: Gg3dWorld<ThreeVisualTypeDocRepo>,
    renderer: ThreeRendererComponent,
  ): ThreePhysicsDebugView
```

### stopDebugView (static method)

**Signature**

```ts
public static stopDebugView(debugView: ThreePhysicsDebugView, renderer: ThreeRendererComponent)
```

### render (method)

**Signature**

```ts
public render(nativeRenderer: WebGLRenderer, nativeCamera: Camera)
```

### lineSegmentPointsForShape (method)

**Signature**

```ts
private lineSegmentPointsForShape(shape: Shape3DMeshDescriptor): Vector3[] | null
```

### dispose (method)

**Signature**

```ts
private dispose()
```
