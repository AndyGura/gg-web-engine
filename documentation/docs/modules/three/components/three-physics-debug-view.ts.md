---
title: three/components/three-physics-debug-view.ts
nav_order: 133
parent: Modules
---

## three-physics-debug-view overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [ThreePhysicsDebugView (class)](#threephysicsdebugview-class)
    - [startDebugView (static method)](#startdebugview-static-method)
    - [stopDebugView (static method)](#stopdebugview-static-method)
    - [initShape (method)](#initshape-method)
    - [render (method)](#render-method)
    - [lineSegmentPointsForShape (method)](#linesegmentpointsforshape-method)
    - [dispose (method)](#dispose-method)

---

# utils

## ThreePhysicsDebugView (class)

**Signature**

```ts
export declare class ThreePhysicsDebugView {
  private constructor(private readonly world: ThreeGgWorld)
}
```

### startDebugView (static method)

**Signature**

```ts
public static startDebugView(world: ThreeGgWorld, renderer: ThreeRendererComponent): ThreePhysicsDebugView
```

### stopDebugView (static method)

**Signature**

```ts
public static stopDebugView(debugView: ThreePhysicsDebugView, renderer: ThreeRendererComponent)
```

### initShape (method)

**Signature**

```ts
initShape(c: IBodyComponent<Point3, Point4>)
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
