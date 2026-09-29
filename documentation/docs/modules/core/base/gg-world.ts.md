---
title: core/base/gg-world.ts
nav_order: 115
parent: Modules
---

## gg-world overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [AudioTypeDocRepo (type alias)](#audiotypedocrepo-type-alias)
  - [GgWorld (class)](#ggworld-class)
    - [init (method)](#init-method)
    - [start (method)](#start-method)
    - [pauseWorld (method)](#pauseworld-method)
    - [resumeWorld (method)](#resumeworld-method)
    - [createClock (method)](#createclock-method)
    - [dispose (method)](#dispose-method)
    - [addPrimitiveRigidBody (method)](#addprimitiverigidbody-method)
    - [addEntity (method)](#addentity-method)
    - [assertNameAvailable (method)](#assertnameavailable-method)
    - [assertSubtreeNamesAvailable (method)](#assertsubtreenamesavailable-method)
    - [unregisterEntity (method)](#unregisterentity-method)
    - [removeEntity (method)](#removeentity-method)
    - [renameEntity (method)](#renameentity-method)
    - [getEntityByName (method)](#getentitybyname-method)
    - [maybeBindAudioListener (method)](#maybebindaudiolistener-method)
    - [onGgStaticInitialized (method)](#onggstaticinitialized-method)
    - [registerConsoleCommands (method)](#registerconsolecommands-method)
    - [visualScene (property)](#visualscene-property)
    - [physicsWorld (property)](#physicsworld-property)
    - [audioScene (property)](#audioscene-property)
    - [worldClock (property)](#worldclock-property)
    - [keyboardInput (property)](#keyboardinput-property)
    - [name (property)](#name-property)
    - [children (property)](#children-property)
    - [tickListeners (property)](#ticklisteners-property)
    - [tickStarted$ (property)](#tickstarted-property)
    - [tickForwardTo$ (property)](#tickforwardto-property)
    - [tickForwardedTo$ (property)](#tickforwardedto-property)
    - [paused$ (property)](#paused-property)
    - [disposed$ (property)](#disposed-property)
  - [GgWorldSceneTypeDocAPatch (type alias)](#ggworldscenetypedocapatch-type-alias)
  - [GgWorldSceneTypeDocPPatch (type alias)](#ggworldscenetypedocppatch-type-alias)
  - [GgWorldSceneTypeDocVPatch (type alias)](#ggworldscenetypedocvpatch-type-alias)
  - [GgWorldSceneTypeRepo (type alias)](#ggworldscenetyperepo-type-alias)
  - [GgWorldTypeDocAPatch (type alias)](#ggworldtypedocapatch-type-alias)
  - [GgWorldTypeDocPPatch (type alias)](#ggworldtypedocppatch-type-alias)
  - [GgWorldTypeDocRepo (type alias)](#ggworldtypedocrepo-type-alias)
  - [GgWorldTypeDocVPatch (type alias)](#ggworldtypedocvpatch-type-alias)
  - [PhysicsTypeDocRepo (type alias)](#physicstypedocrepo-type-alias)
  - [SceneTypeDocOf (type alias)](#scenetypedocof-type-alias)
  - [TypeDocOf (type alias)](#typedocof-type-alias)
  - [VisualTypeDocRepo (type alias)](#visualtypedocrepo-type-alias)

---

# utils

## AudioTypeDocRepo (type alias)

**Signature**

```ts
export type AudioTypeDocRepo<D, R> = {
  factory: IAudioSourceComponentFactory<D, R>
  source: IAudioSourceComponent<D, R>
  clip: unknown
}
```

## GgWorld (class)

**Signature**

```ts
export declare class GgWorld<D, R, TypeDoc, SceneTypeDoc> {
  protected constructor(args: {
    visualScene?: SceneTypeDoc['visualScene']
    physicsWorld?: SceneTypeDoc['physicsWorld']
    audioScene?: SceneTypeDoc['audioScene']
  })
}
```

### init (method)

**Signature**

```ts
public async init()
```

### start (method)

**Signature**

```ts
public start()
```

### pauseWorld (method)

**Signature**

```ts
public pauseWorld()
```

### resumeWorld (method)

**Signature**

```ts
public resumeWorld()
```

### createClock (method)

**Signature**

```ts
public createClock(autoStart: boolean): PausableClock
```

### dispose (method)

**Signature**

```ts
public dispose(): void
```

### addPrimitiveRigidBody (method)

**Signature**

```ts
abstract addPrimitiveRigidBody(
    descr: unknown, // type defined in subclasses
    position?: D,
    rotation?: R,
    material?: unknown, // type defined in subclasses
  ): IPositionable<D, R> & IRenderableEntity<D, R, TypeDoc>;
```

### addEntity (method)

Add `entity` (and, cascading through `IEntity.onSpawned`, every entity nested under it) to
this world. Atomic: either the whole subtree ends up spawned, or nothing changes. Every name in
the subtree is validated up front, before any component/child is touched, so a collision
(with an entity already in the world, or between two entities within the subtree itself)
throws without the entity's bodies or display objects ever reaching the native scenes - and
should spawning still throw partway for any other reason, whatever was already registered is
rolled back before the error propagates.

**Signature**

```ts
public addEntity(entity: IEntity): void
```

### assertNameAvailable (method)

Throw if `name` can't be given to `entity` in this world, i.e. another entity already holds it.

**Signature**

```ts
private assertNameAvailable(entity: IEntity, name: string): void
```

### assertSubtreeNamesAvailable (method)

Throw if `root` or any entity nested under it (at any depth) carries a name that is already in
use in this world or that another entity of the same subtree also carries - checked before any
of them is registered, so a failing `addEntity` never leaves a partially-spawned subtree behind.

**Signature**

```ts
private assertSubtreeNamesAvailable(root: IEntity): void
```

### unregisterEntity (method)

**Signature**

```ts
private unregisterEntity(entity: IEntity): void
```

### removeEntity (method)

**Signature**

```ts
public removeEntity(entity: IEntity, dispose = false): void
```

### renameEntity (method)

Update this world's name index to reflect `entity` being renamed to `newName` - called by
`IEntity`'s own `name` setter, not meant to be called directly. Validates uniqueness the same
way `addEntity` does.

**Signature**

```ts
public renameEntity(entity: IEntity, newName: string): void
```

### getEntityByName (method)

Find an entity anywhere in the world by name - an O(1) lookup backed by an index kept in sync
by `addEntity`/`removeEntity`/`renameEntity`, covering every entity ever added via `addEntity`
(nested entities included - `addChildren`/`onSpawned` cascade into it too); to search inside
one particular entity's own subtree instead, use `IEntity.getChildEntityByName`. Names are
enforced unique world-wide - `addEntity` and the `name` setter both throw on a collision - so
there is never more than one match to choose between.

**Signature**

```ts
public getEntityByName<T extends IEntity = IEntity>(name: string): T
```

### maybeBindAudioListener (method)

**Signature**

```ts
private maybeBindAudioListener(entity: IEntity): void
```

### onGgStaticInitialized (method)

**Signature**

```ts
private onGgStaticInitialized()
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

### visualScene (property)

**Signature**

```ts
readonly visualScene: SceneTypeDoc["visualScene"]
```

### physicsWorld (property)

**Signature**

```ts
readonly physicsWorld: SceneTypeDoc["physicsWorld"]
```

### audioScene (property)

**Signature**

```ts
readonly audioScene: SceneTypeDoc["audioScene"]
```

### worldClock (property)

**Signature**

```ts
readonly worldClock: PausableClock
```

### keyboardInput (property)

**Signature**

```ts
readonly keyboardInput: KeyboardInput
```

### name (property)

**Signature**

```ts
name: string
```

### children (property)

**Signature**

```ts
readonly children: IEntity<any, any, GgWorldTypeDocRepo<any, any>>[]
```

### tickListeners (property)

**Signature**

```ts
readonly tickListeners: IEntity<any, any, GgWorldTypeDocRepo<any, any>>[]
```

### tickStarted$ (property)

**Signature**

```ts
readonly tickStarted$: any
```

### tickForwardTo$ (property)

**Signature**

```ts
readonly tickForwardTo$: any
```

### tickForwardedTo$ (property)

**Signature**

```ts
readonly tickForwardedTo$: any
```

### paused$ (property)

**Signature**

```ts
readonly paused$: any
```

### disposed$ (property)

**Signature**

```ts
readonly disposed$: any
```

## GgWorldSceneTypeDocAPatch (type alias)

**Signature**

```ts
export type GgWorldSceneTypeDocAPatch<
  D,
  R,
  ATypeDoc extends AudioTypeDocRepo<D, R>,
  AS extends IAudioSceneComponent<D, R, ATypeDoc> | null
> = Omit<GgWorldSceneTypeRepo<D, R>, 'audioScene'> & { audioScene: AS }
```

## GgWorldSceneTypeDocPPatch (type alias)

**Signature**

```ts
export type GgWorldSceneTypeDocPPatch<
  D,
  R,
  PTypeDoc extends PhysicsTypeDocRepo<D, R>,
  PW extends IPhysicsWorldComponent<D, R, PTypeDoc> | null
> = Omit<GgWorldSceneTypeRepo<D, R>, 'physicsWorld'> & { physicsWorld: PW }
```

## GgWorldSceneTypeDocVPatch (type alias)

**Signature**

```ts
export type GgWorldSceneTypeDocVPatch<
  D,
  R,
  VTypeDoc extends VisualTypeDocRepo2D,
  VS extends IVisualScene2dComponent<VTypeDoc> | null
> = Omit<GgWorldSceneTypeRepo<D, R>, 'visualScene'> & { visualScene: VS }
```

## GgWorldSceneTypeRepo (type alias)

**Signature**

```ts
export type GgWorldSceneTypeRepo<D, R, TypeDoc extends GgWorldTypeDocRepo<D, R> = GgWorldTypeDocRepo<D, R>> = {
  visualScene: IVisualSceneComponent<D, R, TypeDoc['vTypeDoc']> | null
  physicsWorld: IPhysicsWorldComponent<D, R, TypeDoc['pTypeDoc']> | null
  audioScene: IAudioSceneComponent<D, R, TypeDoc['aTypeDoc']> | null
}
```

## GgWorldTypeDocAPatch (type alias)

**Signature**

```ts
export type GgWorldTypeDocAPatch<D, R, ATypeDoc extends AudioTypeDocRepo<D, R>> = Omit<
  GgWorldTypeDocRepo<D, R>,
  'aTypeDoc'
> & {
  aTypeDoc: ATypeDoc
}
```

## GgWorldTypeDocPPatch (type alias)

**Signature**

```ts
export type GgWorldTypeDocPPatch<D, R, PTypeDoc extends PhysicsTypeDocRepo<D, R>> = Omit<
  GgWorldTypeDocRepo<D, R>,
  'pTypeDoc'
> & {
  pTypeDoc: PTypeDoc
}
```

## GgWorldTypeDocRepo (type alias)

**Signature**

```ts
export type GgWorldTypeDocRepo<D, R> = {
  vTypeDoc: VisualTypeDocRepo<D, R>
  pTypeDoc: PhysicsTypeDocRepo<D, R>
  aTypeDoc: AudioTypeDocRepo<D, R>
}
```

## GgWorldTypeDocVPatch (type alias)

**Signature**

```ts
export type GgWorldTypeDocVPatch<D, R, VTypeDoc extends VisualTypeDocRepo<D, R>> = Omit<
  GgWorldTypeDocRepo<D, R>,
  'vTypeDoc'
> & {
  vTypeDoc: VTypeDoc
}
```

## PhysicsTypeDocRepo (type alias)

**Signature**

```ts
export type PhysicsTypeDocRepo<D, R> = {
  factory: unknown
  rigidBody: IRigidBodyComponent<D, R>
  trigger: ITriggerComponent<D, R>
}
```

## SceneTypeDocOf (type alias)

**Signature**

```ts
export type SceneTypeDocOf<W extends GgWorld<any, any>> = W extends GgWorld<
  infer D,
  infer R,
  infer TypeDoc,
  infer SceneTypeDoc
>
  ? SceneTypeDoc
  : never
```

## TypeDocOf (type alias)

**Signature**

```ts
export type TypeDocOf<W extends GgWorld<any, any>> = W extends GgWorld<infer D, infer R, infer TypeDoc>
  ? TypeDoc
  : never
```

## VisualTypeDocRepo (type alias)

**Signature**

```ts
export type VisualTypeDocRepo<D, R> = {
  factory: unknown
  displayObject: IDisplayObjectComponent<D, R>
  renderer: IRendererComponent<D, R>
  rendererExtraOpts: {}
  camera: IPositionable<D, R>
}
```
