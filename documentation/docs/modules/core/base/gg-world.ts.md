---
title: core/base/gg-world.ts
nav_order: 125
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
    - [pauseWhenHidden (property)](#pausewhenhidden-property)
    - [visibility$ (property)](#visibility-property)
    - [fixedPhysicsStep (property)](#fixedphysicsstep-property)
    - [maxPhysicsStepsPerTick (property)](#maxphysicsstepspertick-property)
    - [name (property)](#name-property)
    - [eventAuthority (property)](#eventauthority-property)
    - [commandGuard (property)](#commandguard-property)
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
    /**
     * Upper bound, in milliseconds, on any single tick delta this world's `worldClock` (and
     * therefore every entity's `tick$` and `physicsWorld.simulate`) ever sees - forwarded straight
     * to `worldClock.maxTickDelta`. Defaults to `PausableClock`'s own default (250ms) when omitted;
     * pass `0` to disable clamping entirely. See `PausableClock.maxTickDelta`'s own doc for what
     * clamping does to `elapsedTime`.
     */
    maxTickDelta?: number
    /**
     * When `true`, this world pauses itself while the document/tab is hidden and resumes itself
     * when it becomes visible again (unless the app had already paused it itself) - see
     * `GgWorld.pauseWhenHidden`'s own doc. Defaults to `false`.
     */
    pauseWhenHidden?: boolean
    /**
     * Opt-in fixed physics timestep, in milliseconds. Left `undefined` (the default), the tick
     * loop keeps its original behavior: `physicsWorld.simulate(delta)` is called exactly once per
     * world tick, with that tick's own (variable) delta. Set to a value, the tick loop instead
     * accumulates each tick's delta and calls `physicsWorld.simulate(fixedPhysicsStep)` as many
     * times as fit in the accumulator (0 or more - a tick faster than `fixedPhysicsStep` may call
     * `simulate` zero times, letting time accumulate across ticks), carrying any leftover
     * fractional time over to the next tick. This gives the physics engine a constant, reproducible
     * step size regardless of the actual frame rate, at the cost of it running zero, one, or
     * several times within a single rendered frame. `maxPhysicsStepsPerTick` bounds how many of
     * those calls a single world tick can make.
     */
    fixedPhysicsStep?: number
    /**
     * Spiral-of-death guard for `fixedPhysicsStep`: the most `simulate()` calls one world tick may
     * make before the rest of that tick's accumulated time is dropped instead of carried over to
     * the next tick (e.g. after the tab was backgrounded and comes back with a huge delta). Only
     * meaningful when `fixedPhysicsStep` is set. Defaults to 8. `PausableClock`'s own bounded tick
     * delta (`maxTickDelta`, where available) is a complementary safeguard at the clock level -
     * this cap is what keeps a single tick's physics work bounded even if an oversized delta
     * reaches `GgWorld` anyway.
     */
    maxPhysicsStepsPerTick?: number
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
rolled back before the error propagates. Emits `entityAdded$` for `entity` once its own spawn
has fully succeeded - see that getter's own doc for the nested-cascade emission order.

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
      mutates?: boolean,
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

### pauseWhenHidden (property)

When `true`, this world pauses itself automatically while the document/tab is hidden
(`document.visibilitychange`, checked via `document.hidden`) and resumes itself once visible
again - but only if the world wasn't already paused by app code at the moment it went hidden.
A world the app paused itself stays paused across a hide/show cycle; this flag never resumes
it. Defaults to `false`. The subscription is set up in `init()` and torn down in `dispose()`;
on a host with no `document` (e.g. a non-browser/jsdom-less test harness) this is a no-op -
nothing ever gets paused/resumed by visibility regardless of this flag.

**Signature**

```ts
readonly pauseWhenHidden: boolean
```

### visibility$ (property)

Emits the document/tab's visibility state (`true` = visible, `false` = hidden) every time it
changes, regardless of `pauseWhenHidden` - apps can subscribe directly (e.g. to mute audio, or
drop network updates while hidden) without opting into the auto-pause behavior. On a host with
no `document` (jsdom-less tests, non-browser hosts) this simply never emits - a safe no-op
fallback rather than throwing.

**Signature**

```ts
readonly visibility$: any
```

### fixedPhysicsStep (property)

When set, `physicsWorld.simulate()` is driven by a fixed-timestep accumulator instead of the
raw per-tick delta - see the constructor's `fixedPhysicsStep` argument doc for the full
semantics.

**Signature**

```ts
readonly fixedPhysicsStep: number | undefined
```

### maxPhysicsStepsPerTick (property)

Spiral-of-death guard for the `fixedPhysicsStep` accumulator: the most `simulate()` calls one
world tick is allowed to make before the remaining accumulated time is dropped instead of
carried over. Only meaningful when `fixedPhysicsStep` is set. Defaults to 8.

**Signature**

```ts
readonly maxPhysicsStepsPerTick: number
```

### name (property)

**Signature**

```ts
name: string
```

### eventAuthority (property)

Consulted by every level JSON `events` binding (see `LevelLoader.createEntity`) right before it
runs its blueprint: `false` skips that run. Defaults to always `true`, so single-player
behavior is unaffected. A network layer installs a rule here while a session is joined, so a
gameplay-consequential binding (a coin's trigger removing the coin, say) runs on exactly the one
peer holding authority over the event instead of on every peer, and restores the default on
leave.

**Signature**

```ts
eventAuthority: (entity: IEntity, eventName: string, payload: unknown) => boolean
```

### commandGuard (property)

Consulted by the dev console before running one of this world's commands registered as mutating
(`mutates: true`, see `GgStatic.registerConsoleCommand`): a returned string rejects the command
with that reason, `null` lets it run. `null` (the default) means no guard. A network layer
installs one while a session is joined, since a local-only edit of shared world state would
silently desync peers. A local guardrail, not a trust boundary.

**Signature**

```ts
commandGuard: ((command: string, args: string[]) => string | null) | null
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
