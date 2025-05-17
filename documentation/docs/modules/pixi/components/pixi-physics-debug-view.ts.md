---
title: pixi/components/pixi-physics-debug-view.ts
nav_order: 110
parent: Modules
---

## pixi-physics-debug-view overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [PixiPhysicsDebugView (class)](#pixiphysicsdebugview-class)
    - [initShape (method)](#initshape-method)
    - [sync (method)](#sync-method)
    - [lineSegmentPointsForShape (method)](#linesegmentpointsforshape-method)
    - [dispose (method)](#dispose-method)
    - [debugContainer (property)](#debugcontainer-property)

---

# utils

## PixiPhysicsDebugView (class)

**Signature**

```ts
export declare class PixiPhysicsDebugView {
  constructor(private readonly world: PixiGgWorld)
}
```

### initShape (method)

**Signature**

```ts
initShape(c: IBodyComponent<Point2, number>)
```

### sync (method)

**Signature**

```ts
public sync()
```

### lineSegmentPointsForShape (method)

**Signature**

```ts
private lineSegmentPointsForShape(shape: Shape2DDescriptor): Point2[]
```

### dispose (method)

**Signature**

```ts
public dispose()
```

### debugContainer (property)

**Signature**

```ts
readonly debugContainer: any
```
