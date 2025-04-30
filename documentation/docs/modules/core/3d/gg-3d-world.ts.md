---
title: core/3d/gg-3d-world.ts
nav_order: 51
parent: Modules
---

## gg-3d-world overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [Gg3dWorld (class)](#gg3dworld-class)
    - [addPrimitiveRigidBody (method)](#addprimitiverigidbody-method)
    - [addRenderer (method)](#addrenderer-method)
    - [registerConsoleCommands (method)](#registerconsolecommands-method)
    - [loader (property)](#loader-property)
  - [PhysicsTypeDocRepo3D (type alias)](#physicstypedocrepo3d-type-alias)
  - [VisualTypeDocRepo3D (type alias)](#visualtypedocrepo3d-type-alias)

---

# utils

## Gg3dWorld (class)

**Signature**

```ts
export declare class Gg3dWorld<VTypeDoc, PTypeDoc, VS, PW> {
  constructor(public readonly visualScene: VS, public readonly physicsWorld: PW)
}
```

### addPrimitiveRigidBody (method)

**Signature**

```ts
addPrimitiveRigidBody(
    descr: BodyShape3DDescriptor,
    position: Point3 = Pnt3.O,
    rotation: Point4 = Qtrn.O,
    material: DisplayObject3dOpts<VTypeDoc['texture']> = {},
  ): Entity3d<VTypeDoc, PTypeDoc>
```

### addRenderer (method)

**Signature**

```ts
addRenderer(
    camera: VTypeDoc['camera'],
    canvas?: HTMLCanvasElement,
    rendererOptions?: Partial<RendererOptions & VTypeDoc['rendererExtraOpts']>,
  ): Renderer3dEntity<VTypeDoc>
```

### registerConsoleCommands (method)

**Signature**

```ts
protected registerConsoleCommands(ggstatic: {
    registerConsoleCommand: (
      world: GgWorld<any, any> | null,
      command: string,
      handler: (...args: string[]) => Promise<string>,
      doc?: string,
    ) => void;
  })
```

### loader (property)

**Signature**

```ts
readonly loader: Gg3dLoader<VTypeDoc, PTypeDoc>
```

## PhysicsTypeDocRepo3D (type alias)

**Signature**

```ts
export type PhysicsTypeDocRepo3D = {
  factory: IPhysicsBody3dComponentFactory
  loader: IPhysicsBody3dComponentLoader
  rigidBody: IRigidBody3dComponent
  trigger: ITrigger3dComponent
  raycastVehicle: IRaycastVehicleComponent
}
```

## VisualTypeDocRepo3D (type alias)

**Signature**

```ts
export type VisualTypeDocRepo3D = {
  factory: IDisplayObject3dComponentFactory
  loader: IDisplayObject3dComponentLoader
  displayObject: IDisplayObject3dComponent
  renderer: IRenderer3dComponent
  rendererExtraOpts: {}
  camera: ICameraComponent
  texture: unknown
}
```
