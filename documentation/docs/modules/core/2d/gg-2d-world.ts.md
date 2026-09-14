---
title: core/2d/gg-2d-world.ts
nav_order: 28
parent: Modules
---

## gg-2d-world overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [AudioTypeDocRepo2D (type alias)](#audiotypedocrepo2d-type-alias)
  - [Gg2dWorld (class)](#gg2dworld-class)
    - [addPrimitiveRigidBody (method)](#addprimitiverigidbody-method)
    - [addRenderer (method)](#addrenderer-method)
    - [registerConsoleCommands (method)](#registerconsolecommands-method)
    - [loader (property)](#loader-property)
  - [Gg2dWorldSceneTypeDocAPatch (type alias)](#gg2dworldscenetypedocapatch-type-alias)
  - [Gg2dWorldSceneTypeDocPPatch (type alias)](#gg2dworldscenetypedocppatch-type-alias)
  - [Gg2dWorldSceneTypeDocVPatch (type alias)](#gg2dworldscenetypedocvpatch-type-alias)
  - [Gg2dWorldSceneTypeRepo (type alias)](#gg2dworldscenetyperepo-type-alias)
  - [Gg2dWorldTypeDocAPatch (type alias)](#gg2dworldtypedocapatch-type-alias)
  - [Gg2dWorldTypeDocPPatch (type alias)](#gg2dworldtypedocppatch-type-alias)
  - [Gg2dWorldTypeDocRepo (type alias)](#gg2dworldtypedocrepo-type-alias)
  - [Gg2dWorldTypeDocVPatch (type alias)](#gg2dworldtypedocvpatch-type-alias)
  - [PhysicsTypeDocRepo2D (type alias)](#physicstypedocrepo2d-type-alias)
  - [TypedGg2dWorld (type alias)](#typedgg2dworld-type-alias)
  - [VisualTypeDocRepo2D (type alias)](#visualtypedocrepo2d-type-alias)

---

# utils

## AudioTypeDocRepo2D (type alias)

**Signature**

```ts
export type AudioTypeDocRepo2D = {
  factory: IAudioSource2dComponentFactory
  source: IAudioSource2dComponent
  clip: unknown
}
```

## Gg2dWorld (class)

**Signature**

```ts
export declare class Gg2dWorld<TypeDoc, SceneTypeDoc> {
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
    descr: BodyShape2DDescriptor,
    position: Point2 = Pnt2.O,
    rotation: number = 0,
    material: DisplayObject2dOpts<TypeDoc['vTypeDoc']['texture']> = {},
  ): Entity2d<TypeDoc>
```

### addRenderer (method)

**Signature**

```ts
addRenderer(
    camera: TypeDoc['vTypeDoc']['camera'],
    canvas?: HTMLCanvasElement,
    rendererOptions?: Partial<RendererOptions & TypeDoc['vTypeDoc']['rendererExtraOpts']>,
  ): Renderer2dEntity<TypeDoc['vTypeDoc']>
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
readonly loader: Gg2dLoader<TypeDoc>
```

## Gg2dWorldSceneTypeDocAPatch (type alias)

**Signature**

```ts
export type Gg2dWorldSceneTypeDocAPatch<
  ATypeDoc extends AudioTypeDocRepo2D,
  AS extends IAudioScene2dComponent<ATypeDoc> | null
> = Omit<Gg2dWorldSceneTypeRepo, 'audioScene'> & { audioScene: AS }
```

## Gg2dWorldSceneTypeDocPPatch (type alias)

**Signature**

```ts
export type Gg2dWorldSceneTypeDocPPatch<
  PTypeDoc extends PhysicsTypeDocRepo2D,
  PW extends IPhysicsWorld2dComponent<PTypeDoc> | null
> = Omit<Gg2dWorldSceneTypeRepo, 'physicsWorld'> & { physicsWorld: PW }
```

## Gg2dWorldSceneTypeDocVPatch (type alias)

**Signature**

```ts
export type Gg2dWorldSceneTypeDocVPatch<
  VTypeDoc extends VisualTypeDocRepo2D,
  VS extends IVisualScene2dComponent<VTypeDoc> | null
> = Omit<Gg2dWorldSceneTypeRepo, 'visualScene'> & { visualScene: VS }
```

## Gg2dWorldSceneTypeRepo (type alias)

**Signature**

```ts
export type Gg2dWorldSceneTypeRepo<TypeDoc extends Gg2dWorldTypeDocRepo = Gg2dWorldTypeDocRepo> = {
  visualScene: IVisualScene2dComponent<TypeDoc['vTypeDoc']> | null
  physicsWorld: IPhysicsWorld2dComponent<TypeDoc['pTypeDoc']> | null
  audioScene: IAudioScene2dComponent<TypeDoc['aTypeDoc']> | null
}
```

## Gg2dWorldTypeDocAPatch (type alias)

**Signature**

```ts
export type Gg2dWorldTypeDocAPatch<ATypeDoc extends AudioTypeDocRepo2D> = Omit<Gg2dWorldTypeDocRepo, 'aTypeDoc'> & {
  aTypeDoc: ATypeDoc
}
```

## Gg2dWorldTypeDocPPatch (type alias)

**Signature**

```ts
export type Gg2dWorldTypeDocPPatch<PTypeDoc extends PhysicsTypeDocRepo2D> = Omit<Gg2dWorldTypeDocRepo, 'pTypeDoc'> & {
  pTypeDoc: PTypeDoc
}
```

## Gg2dWorldTypeDocRepo (type alias)

**Signature**

```ts
export type Gg2dWorldTypeDocRepo = {
  vTypeDoc: VisualTypeDocRepo2D
  pTypeDoc: PhysicsTypeDocRepo2D
  aTypeDoc: AudioTypeDocRepo2D
}
```

## Gg2dWorldTypeDocVPatch (type alias)

**Signature**

```ts
export type Gg2dWorldTypeDocVPatch<VTypeDoc extends VisualTypeDocRepo2D> = Omit<Gg2dWorldTypeDocRepo, 'vTypeDoc'> & {
  vTypeDoc: VTypeDoc
}
```

## PhysicsTypeDocRepo2D (type alias)

**Signature**

```ts
export type PhysicsTypeDocRepo2D = {
  factory: IPhysicsBody2dComponentFactory
  rigidBody: IRigidBody2dComponent
  trigger: ITrigger2dComponent
}
```

## TypedGg2dWorld (type alias)

**Signature**

```ts
export type TypedGg2dWorld<
  VW extends Gg2dWorld<any> | null,
  PW extends Gg2dWorld<any> | null,
  AW extends Gg2dWorld<any> | null = null
> = VW extends Gg2dWorld<infer VTD, infer VSTD> | null
  ? PW extends Gg2dWorld<infer PTD, infer PSTD> | null
    ? AW extends Gg2dWorld<infer ATD, infer ASTD>
      ? Gg2dWorld<
          { vTypeDoc: VTD['vTypeDoc']; pTypeDoc: PTD['pTypeDoc']; aTypeDoc: ATD['aTypeDoc'] },
          { visualScene: VSTD['visualScene']; physicsWorld: PSTD['physicsWorld']; audioScene: ASTD['audioScene'] }
        >
      : Gg2dWorld<
          { vTypeDoc: VTD['vTypeDoc']; pTypeDoc: PTD['pTypeDoc']; aTypeDoc: AudioTypeDocRepo2D },
          {
            visualScene: VSTD['visualScene']
            physicsWorld: PSTD['physicsWorld']
            audioScene: IAudioScene2dComponent | null
          }
        >
    : never
  : never
```

## VisualTypeDocRepo2D (type alias)

**Signature**

```ts
export type VisualTypeDocRepo2D = {
  factory: IDisplayObject2dComponentFactory
  displayObject: IDisplayObject2dComponent
  renderer: IRenderer2dComponent
  rendererExtraOpts: {}
  camera: ICamera2dComponent
  texture: unknown
}
```
