---
title: core/3d/gg-3d-world.ts
nav_order: 68
parent: Modules
---

## gg-3d-world overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [AudioTypeDocRepo3D (type alias)](#audiotypedocrepo3d-type-alias)
  - [Gg3dWorld (class)](#gg3dworld-class)
    - [addPrimitiveRigidBody (method)](#addprimitiverigidbody-method)
    - [addGrabbablePrimitive (method)](#addgrabbableprimitive-method)
    - [addRenderer (method)](#addrenderer-method)
    - [registerConsoleCommands (method)](#registerconsolecommands-method)
    - [loader (property)](#loader-property)
  - [Gg3dWorldSceneTypeDocAPatch (type alias)](#gg3dworldscenetypedocapatch-type-alias)
  - [Gg3dWorldSceneTypeDocPPatch (type alias)](#gg3dworldscenetypedocppatch-type-alias)
  - [Gg3dWorldSceneTypeDocVPatch (type alias)](#gg3dworldscenetypedocvpatch-type-alias)
  - [Gg3dWorldSceneTypeRepo (type alias)](#gg3dworldscenetyperepo-type-alias)
  - [Gg3dWorldTypeDocAPatch (type alias)](#gg3dworldtypedocapatch-type-alias)
  - [Gg3dWorldTypeDocPPatch (type alias)](#gg3dworldtypedocppatch-type-alias)
  - [Gg3dWorldTypeDocRepo (type alias)](#gg3dworldtypedocrepo-type-alias)
  - [Gg3dWorldTypeDocVPatch (type alias)](#gg3dworldtypedocvpatch-type-alias)
  - [PhysicsTypeDocRepo3D (type alias)](#physicstypedocrepo3d-type-alias)
  - [TypedGg3dWorld (type alias)](#typedgg3dworld-type-alias)
  - [VisualTypeDocRepo3D (type alias)](#visualtypedocrepo3d-type-alias)

---

# utils

## AudioTypeDocRepo3D (type alias)

**Signature**

```ts
export type AudioTypeDocRepo3D = {
  factory: IAudioSource3dComponentFactory
  source: IAudioSource3dComponent
  clip: unknown
}
```

## Gg3dWorld (class)

**Signature**

```ts
export declare class Gg3dWorld<TypeDoc, SceneTypeDoc> {
  constructor(args: {
    visualScene?: SceneTypeDoc['visualScene']
    physicsWorld?: SceneTypeDoc['physicsWorld']
    audioScene?: SceneTypeDoc['audioScene']
  })
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

### addGrabbablePrimitive (method)

Same as `addPrimitiveRigidBody`, but the returned entity is a `Grabbable3dEntity` - a prop
that can be picked up/carried/thrown (see that class and `ObjectGrabController`). `descr.body`
must describe a dynamic body (`dynamic: true`) - a static/kinematic prop can't be carried.

**Signature**

```ts
addGrabbablePrimitive(
    descr: BodyShape3DDescriptor,
    position: Point3 = Pnt3.O,
    rotation: Point4 = Qtrn.O,
    material: DisplayObject3dOpts<TypeDoc['vTypeDoc']['texture']> = {},
    grabOptions: Partial<Grabbable3dEntityOptions> = {},
  ): Grabbable3dEntity<TypeDoc>
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

## Gg3dWorldSceneTypeDocAPatch (type alias)

**Signature**

```ts
export type Gg3dWorldSceneTypeDocAPatch<
  ATypeDoc extends AudioTypeDocRepo3D,
  AS extends IAudioScene3dComponent<ATypeDoc> | null
> = Omit<Gg3dWorldSceneTypeRepo, 'audioScene'> & { audioScene: AS }
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
  audioScene: IAudioScene3dComponent<TypeDoc['aTypeDoc']> | null
}
```

## Gg3dWorldTypeDocAPatch (type alias)

**Signature**

```ts
export type Gg3dWorldTypeDocAPatch<ATypeDoc extends AudioTypeDocRepo3D> = Omit<Gg3dWorldTypeDocRepo, 'aTypeDoc'> & {
  aTypeDoc: ATypeDoc
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
  aTypeDoc: AudioTypeDocRepo3D
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
  characterController: ICharacterController3dComponent
}
```

## TypedGg3dWorld (type alias)

**Signature**

```ts
export type TypedGg3dWorld<
  VW extends Gg3dWorld<any> | null,
  PW extends Gg3dWorld<any> | null,
  AW extends Gg3dWorld<any> | null = null
> = VW extends Gg3dWorld<infer VTD, infer VSTD> | null
  ? PW extends Gg3dWorld<infer PTD, infer PSTD> | null
    ? AW extends Gg3dWorld<infer ATD, infer ASTD>
      ? Gg3dWorld<
          { vTypeDoc: VTD['vTypeDoc']; pTypeDoc: PTD['pTypeDoc']; aTypeDoc: ATD['aTypeDoc'] },
          { visualScene: VSTD['visualScene']; physicsWorld: PSTD['physicsWorld']; audioScene: ASTD['audioScene'] }
        >
      : Gg3dWorld<
          { vTypeDoc: VTD['vTypeDoc']; pTypeDoc: PTD['pTypeDoc']; aTypeDoc: AudioTypeDocRepo3D },
          {
            visualScene: VSTD['visualScene']
            physicsWorld: PSTD['physicsWorld']
            audioScene: IAudioScene3dComponent | null
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
  camera: ICamera3dComponent
  texture: unknown
}
```
