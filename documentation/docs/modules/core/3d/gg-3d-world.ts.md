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
  - [Gg3dWorldSceneTypeDocPPatch (type alias)](#gg3dworldscenetypedocppatch-type-alias)
  - [Gg3dWorldSceneTypeDocVPatch (type alias)](#gg3dworldscenetypedocvpatch-type-alias)
  - [Gg3dWorldSceneTypeRepo (type alias)](#gg3dworldscenetyperepo-type-alias)
  - [Gg3dWorldTypeDocPPatch (type alias)](#gg3dworldtypedocppatch-type-alias)
  - [Gg3dWorldTypeDocRepo (type alias)](#gg3dworldtypedocrepo-type-alias)
  - [Gg3dWorldTypeDocVPatch (type alias)](#gg3dworldtypedocvpatch-type-alias)
  - [PhysicsTypeDocRepo3D (type alias)](#physicstypedocrepo3d-type-alias)
  - [TypedGg3dWorld (type alias)](#typedgg3dworld-type-alias)
  - [VisualTypeDocRepo3D (type alias)](#visualtypedocrepo3d-type-alias)

---

# utils

## Gg3dWorld (class)

**Signature**

```ts
export declare class Gg3dWorld<TypeDoc, SceneTypeDoc> {
  constructor(args: { visualScene?: SceneTypeDoc['visualScene']; physicsWorld?: SceneTypeDoc['physicsWorld'] })
}
```

### addPrimitiveRigidBody (method)

**Signature**

```ts
addPrimitiveRigidBody(
    descr: BodyShape3DDescriptor,
    position: Point3 = Pnt3.O,
    rotation: Point4 = Qtrn.O,
    material: DisplayObject3dOpts<TypeDoc['vTypeDoc']['texture']> = {},
  ): Entity3d<TypeDoc>
```

### addRenderer (method)

**Signature**

```ts
addRenderer(
    camera: TypeDoc['vTypeDoc']['camera'],
    canvas?: HTMLCanvasElement,
    rendererOptions?: Partial<RendererOptions & TypeDoc['vTypeDoc']['rendererExtraOpts']>,
  ): Renderer3dEntity<TypeDoc['vTypeDoc']>
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
readonly loader: Gg3dLoader<TypeDoc>
```

## Gg3dWorldSceneTypeDocPPatch (type alias)

**Signature**

```ts
export type Gg3dWorldSceneTypeDocPPatch<
  PTypeDoc extends PhysicsTypeDocRepo3D,
  PW extends IPhysicsWorld3dComponent<PTypeDoc> | null
> = Omit<Gg3dWorldSceneTypeRepo, 'physicsWorld'> & { physicsWorld: PW }
```

## Gg3dWorldSceneTypeDocVPatch (type alias)

**Signature**

```ts
export type Gg3dWorldSceneTypeDocVPatch<
  VTypeDoc extends VisualTypeDocRepo3D,
  VS extends IVisualScene3dComponent<VTypeDoc> | null
> = Omit<Gg3dWorldSceneTypeRepo, 'visualScene'> & { visualScene: VS }
```

## Gg3dWorldSceneTypeRepo (type alias)

**Signature**

```ts
export type Gg3dWorldSceneTypeRepo<TypeDoc extends Gg3dWorldTypeDocRepo = Gg3dWorldTypeDocRepo> = {
  visualScene: IVisualScene3dComponent<TypeDoc['vTypeDoc']> | null
  physicsWorld: IPhysicsWorld3dComponent<TypeDoc['pTypeDoc']> | null
}
```

## Gg3dWorldTypeDocPPatch (type alias)

**Signature**

```ts
export type Gg3dWorldTypeDocPPatch<PTypeDoc extends PhysicsTypeDocRepo3D> = Omit<Gg3dWorldTypeDocRepo, 'pTypeDoc'> & {
  pTypeDoc: PTypeDoc
}
```

## Gg3dWorldTypeDocRepo (type alias)

**Signature**

```ts
export type Gg3dWorldTypeDocRepo = {
  vTypeDoc: VisualTypeDocRepo3D
  pTypeDoc: PhysicsTypeDocRepo3D
}
```

## Gg3dWorldTypeDocVPatch (type alias)

**Signature**

```ts
export type Gg3dWorldTypeDocVPatch<VTypeDoc extends VisualTypeDocRepo3D> = Omit<Gg3dWorldTypeDocRepo, 'vTypeDoc'> & {
  vTypeDoc: VTypeDoc
}
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

## TypedGg3dWorld (type alias)

**Signature**

```ts
export type TypedGg3dWorld<VW extends Gg3dWorld<any> | null, PW extends Gg3dWorld<any> | null> = VW extends Gg3dWorld<
  infer VTD,
  infer VSTD
> | null
  ? PW extends Gg3dWorld<infer PTD, infer PSTD> | null
    ? Gg3dWorld<
        {
          vTypeDoc: VTD['vTypeDoc']
          pTypeDoc: PTD['pTypeDoc']
        },
        {
          visualScene: VSTD['visualScene']
          physicsWorld: PSTD['physicsWorld']
        }
      >
    : never
  : never
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
