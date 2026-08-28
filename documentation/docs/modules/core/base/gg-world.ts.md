---
title: core/base/gg-world.ts
nav_order: 87
parent: Modules
---

## gg-world overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [GgWorld (class)](#ggworld-class)
    - [init (method)](#init-method)
    - [start (method)](#start-method)
    - [pauseWorld (method)](#pauseworld-method)
    - [resumeWorld (method)](#resumeworld-method)
    - [createClock (method)](#createclock-method)
    - [dispose (method)](#dispose-method)
    - [addPrimitiveRigidBody (method)](#addprimitiverigidbody-method)
    - [addEntity (method)](#addentity-method)
    - [removeEntity (method)](#removeentity-method)
    - [getEntityByName (method)](#getentitybyname-method)
    - [onGgStaticInitialized (method)](#onggstaticinitialized-method)
    - [registerConsoleCommands (method)](#registerconsolecommands-method)
    - [visualScene (property)](#visualscene-property)
    - [physicsWorld (property)](#physicsworld-property)
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
  - [GgWorldSceneTypeDocPPatch (type alias)](#ggworldscenetypedocppatch-type-alias)
  - [GgWorldSceneTypeDocVPatch (type alias)](#ggworldscenetypedocvpatch-type-alias)
  - [GgWorldSceneTypeRepo (type alias)](#ggworldscenetyperepo-type-alias)
  - [GgWorldTypeDocPPatch (type alias)](#ggworldtypedocppatch-type-alias)
  - [GgWorldTypeDocRepo (type alias)](#ggworldtypedocrepo-type-alias)
  - [GgWorldTypeDocVPatch (type alias)](#ggworldtypedocvpatch-type-alias)
  - [PhysicsTypeDocRepo (type alias)](#physicstypedocrepo-type-alias)
  - [SceneTypeDocOf (type alias)](#scenetypedocof-type-alias)
  - [TypeDocOf (type alias)](#typedocof-type-alias)
  - [VisualTypeDocRepo (type alias)](#visualtypedocrepo-type-alias)

---

# utils

## GgWorld (class)

**Signature**

```ts
export declare class GgWorld<D, R, TypeDoc, SceneTypeDoc> {
  protected constructor(args: {
    visualScene?: SceneTypeDoc['visualScene']
    physicsWorld?: SceneTypeDoc['physicsWorld']
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

**Signature**

```ts
public addEntity(entity: IEntity): void
```

### removeEntity (method)

**Signature**

```ts
public removeEntity(entity: IEntity, dispose = false): void
```

### getEntityByName (method)

Find an entity anywhere in the world by name. `children` is a flat list of every entity ever
added via `addEntity` (nested entities included - `addChildren`/`onSpawned` cascade into it
too), so this is a plain linear scan, not a tree walk; to search inside one particular
entity's own subtree instead, use `IEntity.getChildEntityByName`.

**Signature**

```ts
public getEntityByName<T extends IEntity = IEntity>(name: string): T
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
