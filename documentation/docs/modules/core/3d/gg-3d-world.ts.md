---
title: core/3d/gg-3d-world.ts
nav_order: 47
parent: Modules
---

## gg-3d-world overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [Gg3dWorld (class)](#gg3dworld-class)
    - [addPrimitiveRigidBody (method)](#addprimitiverigidbody-method)
    - [addRenderer (method)](#addrenderer-method)
    - [loader (property)](#loader-property)

---

# utils

## Gg3dWorld (class)

**Signature**

```ts
export declare class Gg3dWorld<V, P> {
  constructor(
    public readonly visualScene: V,
    public readonly physicsWorld: P,
    protected readonly consoleEnabled: boolean = false
  )
}
```

### addPrimitiveRigidBody (method)

**Signature**

```ts
addPrimitiveRigidBody(
    descr: BodyShape3DDescriptor,
    position: Point3 = Pnt3.O,
    rotation: Point4 = Qtrn.O,
  ): Entity3d<V, P>
```

### addRenderer (method)

**Signature**

```ts
addRenderer<
    CC extends ICameraComponent<V> = ICameraComponent<V>,
    RC extends IRenderer3dComponent<V, CC> = IRenderer3dComponent<V, CC>,
  >(camera: CC, canvas?: HTMLCanvasElement, rendererOptions?: Partial<RendererOptions>): Renderer3dEntity<V, CC, RC>
```

### loader (property)

**Signature**

```ts
readonly loader: Gg3dLoader
```
