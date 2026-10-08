---
title: core/3d/level-loader.ts
nav_order: 90
parent: Modules
---

## level-loader overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [Camera3DSettings (interface)](#camera3dsettings-interface)
  - [CompoundChild3DSettings (interface)](#compoundchild3dsettings-interface)
  - [Environment3DSettings (interface)](#environment3dsettings-interface)
  - [EnvironmentTexture3DSettings (type alias)](#environmenttexture3dsettings-type-alias)
  - [Gg3dLevelLoader (class)](#gg3dlevelloader-class)
    - [loadTexture (method)](#loadtexture-method)
    - [loadCubeTexture (method)](#loadcubetexture-method)
    - [loadModel (method)](#loadmodel-method)
    - [acquireModel (method)](#acquiremodel-method)
    - [visualLoader (method)](#visualloader-method)
    - [preloadAsset (method)](#preloadasset-method)
    - [registerDefaultClasses (method)](#registerdefaultclasses-method)
    - [serializeLight (method)](#serializelight-method)
    - [serializePrimitive (method)](#serializeprimitive-method)
    - [serializeTrigger (method)](#serializetrigger-method)
    - [buildShapeDescriptor (method)](#buildshapedescriptor-method)
    - [createPrimitive (method)](#createprimitive-method)
    - [createTrigger (method)](#createtrigger-method)
    - [createCamera (method)](#createcamera-method)
    - [createLight (method)](#createlight-method)
    - [createEnvironment (method)](#createenvironment-method)
    - [createSound (method)](#createsound-method)
    - [createPlayer (method)](#createplayer-method)
    - [resolveWheelDisplay (method)](#resolvewheeldisplay-method)
    - [createGgCar (method)](#createggcar-method)
    - [preloadInitialChunks (method)](#preloadinitialchunks-method)
    - [createMapGraph (method)](#createmapgraph-method)
    - [override (property)](#override-property)
  - [GgCar3DCommonSettings (interface)](#ggcar3dcommonsettings-interface)
  - [GgCar3DSettings (type alias)](#ggcar3dsettings-type-alias)
  - [GgCarAxleSettings (type alias)](#ggcaraxlesettings-type-alias)
  - [GgCarSharedWheelSettings (type alias)](#ggcarsharedwheelsettings-type-alias)
  - [GgCarStateSettings (interface)](#ggcarstatesettings-interface)
  - [GgCarWheelDisplaySettings (interface)](#ggcarwheeldisplaysettings-interface)
  - [GgCarWheelSettings (type alias)](#ggcarwheelsettings-type-alias)
  - [Light3DSettings (type alias)](#light3dsettings-type-alias)
  - [MapGraph3DSettings (interface)](#mapgraph3dsettings-interface)
  - [MapGraphNodeJson (type alias)](#mapgraphnodejson-type-alias)
  - [Player3DSettings (type alias)](#player3dsettings-type-alias)
  - [PlayerModel3DSettings (interface)](#playermodel3dsettings-interface)
  - [Primitive3DSettings (interface)](#primitive3dsettings-interface)
  - [Primitive3DShapeName (type alias)](#primitive3dshapename-type-alias)
  - [Primitive3DShapeSettings (interface)](#primitive3dshapesettings-interface)
  - [Sound3DSettings (interface)](#sound3dsettings-interface)
  - [Trigger3DSettings (interface)](#trigger3dsettings-interface)

---

# utils

## Camera3DSettings (interface)

Settings for a camera entity

**Signature**

```ts
export interface Camera3DSettings {
  /**
   * Position of the camera
   */
  position?: Point3

  /**
   * Rotation of the camera
   */
  rotation?: Point4

  /**
   * Field of view in degrees
   */
  fov?: number

  /**
   * Aspect ratio (width / height)
   */
  aspectRatio?: number

  /**
   * Near and far frustum planes
   */
  frustrum?: { near: number; far: number }
}
```

## CompoundChild3DSettings (interface)

One child of a `COMPOUND` primitive's `children` - the same shape-selecting fields as
`Primitive3DSettings`, plus its own local `position`/`rotation` offset, but no `material`/`body`
(a compound's children share one physics body and one display object, set on the parent
`"Primitive"` entity only).

**Signature**

```ts
export interface CompoundChild3DSettings extends Primitive3DShapeSettings {
  /**
   * Position of the child shape, relative to the compound's own origin
   */
  position?: Point3

  /**
   * Rotation of the child shape, relative to the compound's own rotation
   */
  rotation?: Point4
}
```

## Environment3DSettings (interface)

Settings for the built-in `"Environment"` entity class: the scene's background, environment map
and fog (see `IVisualScene3dComponent.setEnvironment`). Only the fields present are applied, and
they're restored to what they were when the level is unloaded (see `Environment3dEntity`). A
no-op without a visual scene.

**Signature**

```ts
export interface Environment3DSettings {
  /** A `0xRRGGBB` color, a sky texture, or `null` to show the renderer's clear color. */
  background?: number | EnvironmentTexture3DSettings | null
  /** Texture lit materials reflect, or `null` for none. */
  environmentMap?: EnvironmentTexture3DSettings | null
  /** Fog, or `null` for none. */
  fog?: Fog3dOpts | null
}
```

## EnvironmentTexture3DSettings (type alias)

A texture reference inside `"Environment"` settings: either six cube-map images (see
`CubeTextureFaces` - each named after the world direction it is seen in, `pz` being the sky
overhead), or one equirectangular (2:1) panorama.

**Signature**

```ts
export type EnvironmentTexture3DSettings = { cube: CubeTextureFaces } | { equirectangular: string }
```

## Gg3dLevelLoader (class)

3D level loader: registers the built-in primitive/trigger/camera/car/map-graph entity classes
and dispatches `LevelJson` entities to them (or to custom classes registered via
`registerClass`).

**Signature**

```ts
export declare class Gg3dLevelLoader<TypeDoc> {
  constructor(protected readonly world: Gg3dWorld<TypeDoc>)
}
```

### loadTexture (method)

Loads an image as a texture, e.g. for `DisplayObject3dOpts.diffuse`, or, with
`{ mapping: 'equirectangular' }`, a panorama for `IVisualScene3dComponent.setEnvironment`.
Cached: the same url with the same options gives the same texture object, freed when the last
scope holding it is released (see `LoadTaskOptions.scope`) - don't dispose it yourself.

**Signature**

```ts
public async loadTexture(
    url: string,
    options: LoadTextureOptions & LoadTaskOptions = {},
  ): Promise<TypeDoc['vTypeDoc']['texture']>
```

### loadCubeTexture (method)

Loads a six-image cube-map sky for `IVisualScene3dComponent.setEnvironment`. Cached and freed
like `loadTexture`.

**Signature**

```ts
public async loadCubeTexture(
    faces: CubeTextureFaces,
    options: LoadTaskOptions = {},
  ): Promise<TypeDoc['vTypeDoc']['texture']>
```

### loadModel (method)

Loads a plain `.glb` (no `.meta` pair - see `loadGgGlb`) via `visualScene.loader.loadFromGlb`,
for a visual-only asset that has no physics representation of its own (a character model
driven by a separately-created `CharacterController3dEntity`'s capsule, a decorative prop, ...).
The file is fetched and parsed once per world; every call returns its own copy to place
(`IDisplayObjectComponent.clone`). `undefined`/`null` if there's no visual scene to load against.

**Signature**

```ts
public async loadModel(
    path: string,
    options: LoadGlbOptions & LoadTaskOptions = {},
  ): Promise<TypeDoc['vTypeDoc']['displayObject'] | null>
```

### acquireModel (method)

The cached, never-shown original of a `loadModel` asset.

**Signature**

```ts
private async acquireModel(
    path: string,
    options: LoadGlbOptions & LoadTaskOptions,
  ): Promise<TypeDoc['vTypeDoc']['displayObject'] | null>
```

### visualLoader (method)

**Signature**

```ts
private visualLoader(): NonNullable<Gg3dWorld<TypeDoc>['visualScene']>['loader']
```

### preloadAsset (method)

**Signature**

```ts
async preloadAsset(ref: AssetRef, options: LoadTaskOptions): Promise<void>
```

### registerDefaultClasses (method)

Register the built-in classes for primitives, triggers, and cameras

**Signature**

```ts
private registerDefaultClasses(): void
```

### serializeLight (method)

Live serializer for the built-in `"Light"` class: matches `entity.constructor === Light3dEntity`
and reads the light's current settings back from `ILight3dComponent.lightOptions`, so a light
created with `Gg3dWorld.addLight` (or whose color/intensity changed after loading) serializes
as it is now.

**Signature**

```ts
private serializeLight(entity: IEntity<Point3, Point4, TypeDoc>): EntityJson | undefined
```

### serializePrimitive (method)

Live serializer for the built-in `"Primitive"` class - see `LiveEntitySerializer`'s own doc for
the general contract. Matches an entity built by `addPrimitiveRigidBody`/`createPrimitive`
exactly (`entity.constructor === Entity3d`, deliberately not `instanceof` - a richer subclass
like `Grabbable3dEntity` needs its own dedicated serializer, not yet provided, to round-trip
correctly instead of silently losing its grabbable behavior). Recovers `shape`/`dimensions`/
`radius`/etc. from `objectBody.debugBodySettings.shape` (the exact `Shape3DDescriptor` the body
was actually built with, tracked by every physics adapter regardless of how the body was
constructed) and `body`/`linearVelocity`/`angularVelocity` from the live physics body itself
(`objectBody.bodyOptions`, `.linearVelocity`, `.angularVelocity`) - not from whatever `config`
the entity may or may not have originally been loaded from. Returns `undefined` (falls through
to the next serializer, then the spawn-record echo) for a shape `"Primitive"` doesn't support
(`COMPOUND`/`CONVEX_HULL`/`MESH`/`TRIANGLE_MESH` - buildable directly via
`physicsWorld.factory.createRigidBody`, just not through this level-JSON class) or an entity
with no physics body at all (`objectBody` unset - a display-only primitive has nothing this
serializer can recover a `shape`/`body` from).

Recovers `material` too, when `object3D` implements `IMaterialReadable3dComponent` (true for
anything built via `IDisplayObject3dComponentFactory.createPrimitive`/its shortcuts, which is
how every `"Primitive"` gets its mesh - see that interface's own doc) - not from whatever
`config` the entity may or may not have originally been loaded from, same as every other field
here. A display-only primitive with no mesh at all, or one built by an adapter that hasn't
wired up `IMaterialReadable3dComponent`, simply omits `material` - same as omitting it when
building one in the first place.

**Signature**

```ts
private serializePrimitive(entity: IEntity<Point3, Point4, TypeDoc>): EntityJson | undefined
```

### serializeTrigger (method)

Live serializer for the built-in `"Trigger"` class - see `serializePrimitive`'s own doc for the
general approach (same `debugBodySettings.shape`-based recovery, applied to a trigger's `ITrigger3dComponent`
instead of a rigid body). Matches `entity.constructor === Trigger3dEntity` exactly.

**Signature**

```ts
private serializeTrigger(entity: IEntity<Point3, Point4, TypeDoc>): EntityJson | undefined
```

### buildShapeDescriptor (method)

Turn a `Primitive3DShapeSettings` (`shape` plus shape-specific fields) into the
`Shape3DDescriptor` consumed by `Gg3dWorld.addPrimitiveRigidBody`. Used both for a
`"Primitive"` entity's own top-level settings and, recursively, for each of a `COMPOUND`
primitive's `children` (which may themselves be `COMPOUND`, nesting arbitrarily deep).

**Signature**

```ts
private buildShapeDescriptor(settings: Primitive3DShapeSettings): Shape3DDescriptor
```

### createPrimitive (method)

Create a primitive entity (both display object and physics body) from a shape descriptor.
`Shape3DDescriptor` (no mesh-only segment options) is used for both the visual and the
physics representation, same as `Gg3dWorld.addPrimitiveRigidBody`'s own shortcut methods.

**Signature**

```ts
private createPrimitive(
    world: Gg3dWorld<TypeDoc>,
    shape: Shape3DDescriptor,
    settings: Primitive3DSettings,
  ): Entity3d<TypeDoc>
```

### createTrigger (method)

Create a trigger entity: a `Trigger3dEntity` wrapping the raw physics trigger component, so
the app can subscribe to `onEntityEntered`/`onEntityLeft` without any extra wiring - see the
base `LevelLoader` docs for how it's parented for level-lifecycle cleanup.

**Signature**

```ts
private createTrigger(
    world: Gg3dWorld<TypeDoc>,
    settings: Trigger3DSettings,
  ): Trigger3dEntity<TypeDoc['pTypeDoc']> | undefined
```

### createCamera (method)

Create a camera entity: a `Camera3dEntity` wrapping the raw camera component, not attached to
any renderer/canvas (a level JSON has no notion of one - `world.addRenderer(entity.camera,
canvas)` once the app has a canvas). Parented under the level's group entity, so it's torn
down along with the rest of the level - put a camera meant to outlive a level swap in a
separate, never-unloaded level instead (see `gg-engine-level-json`'s "Camera" section).

**Signature**

```ts
private createCamera(
    world: Gg3dWorld<TypeDoc>,
    settings: Camera3DSettings,
  ): Camera3dEntity<TypeDoc['vTypeDoc']> | undefined
```

### createLight (method)

Create a `"Light"` entity: a `Light3dEntity` wrapping a light built from the settings'
`Light3dDescriptor` fields. Returns `undefined` without a visual scene.

**Signature**

```ts
private createLight(
    world: Gg3dWorld<TypeDoc>,
    settings: Light3DSettings & { name?: string },
  ): Light3dEntity<TypeDoc['vTypeDoc']> | undefined
```

### createEnvironment (method)

Create an `"Environment"` entity: loads any sky textures the settings reference, then returns
an `Environment3dEntity` that applies them while it is in the world and frees them when it is
disposed. Returns `undefined` without a visual scene.

**Signature**

```ts
private async createEnvironment(
    world: Gg3dWorld<TypeDoc>,
    settings: Environment3DSettings,
    load: LoadTaskOptions = {},
  ): Promise<Environment3dEntity<TypeDoc['vTypeDoc']> | undefined>
```

### createSound (method)

Create a `"Sound"` entity: loads `settings.path` via `audioScene.factory.loadClip` and wraps
the resulting source in a ready-to-use `AudioSource3dEntity`, statically positioned. Returns
`undefined` (no-op) if the world has no `audioScene`, same posture as `createTrigger`/
`createCamera` returning `undefined` for a missing physics/visual scene.

**Signature**

```ts
private async createSound(
    world: Gg3dWorld<TypeDoc>,
    settings: Sound3DSettings,
    load: LoadTaskOptions = {},
  ): Promise<AudioSource3dEntity<TypeDoc> | undefined>
```

### createPlayer (method)

Create a `"Player"` entity: a capsule-shaped `CharacterController3dEntity`, with a matching
auto-generated capsule mesh when `display` is given and there's a visual scene (physics-only/
invisible otherwise). See `Player3DSettings`'s doc for why this doesn't also build a
`PlayerCharacterController`.

**Signature**

```ts
private async createPlayer(
    world: Gg3dWorld<TypeDoc>,
    settings: Player3DSettings,
    load: LoadTaskOptions = {},
  ): Promise<CharacterController3dEntity<TypeDoc> | undefined>
```

### resolveWheelDisplay (method)

Build a `WheelDisplayOptions` for one `"GgCar"` wheel/axle from its (already shared-merged)
settings, via `visualScene.factory.createCylinder`. Returns `undefined` (no visual wheel,
physics-only) if `display` wasn't specified at all, or there's no visual scene to build one
against.

**Signature**

```ts
private resolveWheelDisplay(
    world: Gg3dWorld<TypeDoc>,
    wheelSettings: GgCarSharedWheelSettings,
  ): WheelDisplayOptions | undefined
```

### createGgCar (method)

Create a `"GgCar"` entity: a box chassis rigid body (+ optional matching display box) wrapped
in a full `GgCarEntity`, with each wheel's optional visual mesh built from its settings (see
{@link resolveWheelDisplay}) rather than referencing an existing display object component,
which a level JSON has no way to do. `settings.state`, if given, is applied to the car once
construction completes - see {@link GgCarStateSettings}.

**Signature**

```ts
private createGgCar(world: Gg3dWorld<TypeDoc>, settings: GgCar3DSettings): GgCarEntity<TypeDoc> | undefined
```

### preloadInitialChunks (method)

Makes the chunks a `"MapGraph"` loads first part of the level's load. Only a loader that loads
`.glb`/`.meta` pairs (`Gg3dLoader`) can; here it does nothing.

**Signature**

```ts
protected async preloadInitialChunks(_entity: MapGraph3dEntity<TypeDoc>, _load: LoadTaskOptions): Promise<void>
```

### createMapGraph (method)

**Signature**

```ts
private async createMapGraph(
    world: Gg3dWorld<TypeDoc>,
    settings: MapGraph3DSettings,
    load: LoadTaskOptions = {},
  ): Promise<MapGraph3dEntity<TypeDoc>>
```

### override (property)

**Signature**

```ts
override: any
```

## GgCar3DCommonSettings (interface)

Fields of `GgCarProperties` that don't vary between its `wheelBase`/`wheelOptions` shapes -
carried over into {@link GgCar3DSettings} as-is (already plain JSON-serializable data).

**Signature**

```ts
export interface GgCar3DCommonSettings {
  suspension: GgCarProperties['suspension']
  tractionBias: GgCarProperties['tractionBias']
  mpsToRpmFactor?: GgCarProperties['mpsToRpmFactor']
  engine: GgCarProperties['engine']
  brake: GgCarProperties['brake']
  transmission: GgCarProperties['transmission']
  maxSteerAngle: GgCarProperties['maxSteerAngle']
}
```

## GgCar3DSettings (type alias)

Settings for the built-in `"GgCar"` entity class (3D only): builds a box-shaped chassis rigid
body (+ optional matching display box) and a full `GgCarEntity` on top of it - the procedural
counterpart of the GLB-driven car construction an app does by hand when it instead loads a
modeled chassis mesh/body and derives each wheel's position/specs from named dummy objects in
that same model before constructing `GgCarEntity` directly. This settings type is for the case
where the chassis/wheels are plain primitives rather than loaded meshes, so the whole thing can
be declared as data in a level JSON instead.

**Signature**

```ts
export type GgCar3DSettings = GgCar3DCommonSettings & {
  position?: Point3
  rotation?: Point4

  /**
   * The chassis's box collider/mesh. `body` is merged over a default dynamic body (same shape as
   * `Primitive3DSettings.body`, but with `mass: 800` instead of `1`, since a `mass: 1` chassis is
   * unrealistically light for a car).
   */
  chassis: {
    dimensions: Point3
    material?: DisplayObject3dOpts<any>
    body?: Partial<Body3DOptions>
  }

  /** Initial driving state, applied once right after the car is built - see {@link GgCarStateSettings}. */
  state?: GgCarStateSettings
} & (
    | {
        wheelBase: {
          shared?: GgCarSharedWheelSettings
          front: GgCarAxleSettings
          rear: GgCarAxleSettings
        }
        wheelOptions?: undefined
        sharedWheelOptions?: undefined
      }
    | {
        wheelOptions: GgCarWheelSettings[]
        sharedWheelOptions?: GgCarSharedWheelSettings
        wheelBase?: undefined
      }
  )
```

## GgCarAxleSettings (type alias)

JSON-friendly counterpart of `RVEntityAxleOptions`, for the `"GgCar"` class's `wheelBase.front`/
`wheelBase.rear`.

**Signature**

```ts
export type GgCarAxleSettings = Pick<RVEntityAxleOptions, 'halfAxleWidth' | 'axlePosition' | 'axleHeight'> &
  GgCarSharedWheelSettings
```

## GgCarSharedWheelSettings (type alias)

JSON-friendly counterpart of `RVEntitySharedWheelOptions`: identical except `display` is a
{@link GgCarWheelDisplaySettings} descriptor instead of a ready-made `WheelDisplayOptions`.

**Signature**

```ts
export type GgCarSharedWheelSettings = Omit<RVEntitySharedWheelOptions, 'display'> & {
  display?: GgCarWheelDisplaySettings
}
```

## GgCarStateSettings (interface)

Runtime-mutated driving state a spawn-time `config` alone can never reflect, since all five
fields change continuously as a `"GgCar"` is driven - see `GgCarEntity.serializeSettings`, which
populates this from a live car's own `gear`/`acceleration`/`brake`/`handBrake`/`steeringFactor`
properties, and `Gg3dLevelLoader.createGgCar`, which applies it back onto a freshly-built one
when present. Optional and independent of every other `GgCar3DSettings` field - a hand-authored
level JSON is free to omit it entirely and get a car parked in neutral, same as before this
field existed.

**Signature**

```ts
export interface GgCarStateSettings {
  gear?: number
  acceleration?: number
  brake?: number
  handBrake?: boolean
  steeringFactor?: number
}
```

## GgCarWheelDisplaySettings (interface)

Settings for a `"GgCar"` wheel's optional visual mesh. A level JSON has no way to reference an
existing display object component (unlike programmatic `RVEntityProperties`, whose
`WheelDisplayOptions.displayObject` takes one directly) - instead, supplying `display` at all
makes the `"GgCar"` generator build one itself via `visualScene.factory.createCylinder`, sized
to that wheel's own (or its axle/shared settings') `tyreRadius`/`tyreWidth`. Omit `display`
entirely (on both the wheel and whatever it inherits from) to leave that wheel invisible
(physics-only), same as omitting `WheelDisplayOptions.displayObject` does programmatically.

**Signature**

```ts
export interface GgCarWheelDisplaySettings {
  material?: DisplayObject3dOpts<any>
  wheelObjectDirection?: AxisDirection3
}
```

## GgCarWheelSettings (type alias)

JSON-friendly counterpart of one `RVEntityProperties['wheelOptions']` element, for the
`"GgCar"` class's `wheelOptions` array.

**Signature**

```ts
export type GgCarWheelSettings = GgCarSharedWheelSettings & {
  isLeft: boolean
  isFront: boolean
  position: Point3
}
```

## Light3DSettings (type alias)

Settings for the built-in `"Light"` entity class: a `Light3dDescriptor` (`type`, `color`,
`intensity`, shadow settings, ... - put these in `config`) plus where the light is. Creates a
`Light3dEntity`; a no-op without a visual scene.

**Signature**

```ts
export type Light3DSettings = Light3dDescriptor & {
  /** Position of the light. */
  position?: Point3
  /** Rotation of the light. `DIRECTIONAL`/`SPOT` lights shine along their local `-Z` axis. */
  rotation?: Point4
  /** Point the light shines towards, an alternative to `rotation` for `DIRECTIONAL`/`SPOT` lights. */
  target?: Point3
}
```

## MapGraph3DSettings (interface)

Settings for the built-in `"MapGraph"` entity class (3D only): builds a `MapGraph` from plain
node data and wraps it in a ready-to-use `MapGraph3dEntity`. `graph` mirrors the two
`MapGraph` factory methods - a flat (optionally closed-loop) path via `nodes`, or a rectangular
`grid` - since both already take plain-data node arrays. The resulting entity doesn't implement
`IPositionable3d` (each node carries its own absolute `position`/`rotation`), so there's no
`position`/`rotation` field here - and its `loaderCursor$` still needs to be driven at runtime
from whatever entity's position should determine which nodes are loaded (see
`gg-engine-level-json` skill's "MapGraph" section).

**Signature**

```ts
export interface MapGraph3DSettings {
  graph: { type?: 'array'; nodes: MapGraphNodeJson[]; closed?: boolean } | { type: 'grid'; grid: MapGraphNodeJson[][] }

  /** Depth in the graph to load - see `Gg3dMapGraphEntityOptions.loadDepth` (default `5`) */
  loadDepth?: number

  /** Extra unload-delay depth - see `Gg3dMapGraphEntityOptions.inertia` (default `0`) */
  inertia?: number

  /** Max nodes loaded per tick - see `Gg3dMapGraphEntityOptions.maxNodesLoadingPerTick` (default `1`) */
  maxNodesLoadingPerTick?: number

  /** Ticks/second of the internal load-scheduling clock - see `MapGraph3dEntity.loadRateLimit` (default `1`) */
  loadRateLimit?: number
}
```

## MapGraphNodeJson (type alias)

JSON-friendly counterpart of `MapGraphNodeType`: identical except `loadOptions` may be omitted
(defaulting to `{}`) rather than required, since most nodes need none of it.

**Signature**

```ts
export type MapGraphNodeJson = Omit<MapGraphNodeType, 'loadOptions'> & {
  loadOptions?: MapGraphNodeType['loadOptions']
}
```

## Player3DSettings (type alias)

Settings for the built-in `"Player"` entity class: a capsule-bodied `CharacterController3dEntity`
(see that class's own doc for the gameplay fields below). Only the physics/visual capsule is
built here - the input/camera wiring (`PlayerCharacterController`) needs a live canvas/
`KeyboardInput`/renderer the app supplies, so it's left to the app's own code, the same way a
`"Camera"` entity is just a positioned `Camera3dEntity` while `FreeCameraController`/
`OrbitCameraController` wiring happens outside the level JSON too.

**Signature**

```ts
export type Player3DSettings = Partial<Omit<CharacterController3dEntityOptions, 'radius' | 'centersDistance'>> & {
  /** Spawn position of the character (capsule center). */
  position?: Point3
  /** Spawn rotation of the character. */
  rotation?: Point4
  /** Capsule radius. Default 0.4. */
  radius?: number
  /** Standing capsule centersDistance. Default 1.0. */
  centersDistance?: number
  /**
   * Material options for the auto-generated capsule mesh; omit (along with `model`) for a
   * physics-only, invisible player. `model`, if given, loads an animated character model instead of
   * the capsule mesh entirely - the rest of `display` (`color`/`shading`/...) is then ignored.
   */
  display?: DisplayObject3dOpts<any> & { model?: PlayerModel3DSettings }
  /**
   * Runtime movement state applied once right after the character is built (see `CharacterState3d`) - what
   * `serializeSettings` emits, so a character re-created from its own serialization (e.g. on another
   * peer) continues mid-jump/mid-crouch.
   */
  state?: CharacterState3d
}
```

## PlayerModel3DSettings (interface)

Settings for the built-in `"Player"` entity class's `display.model` - loads a bone-animated `.glb`
character model (via `loadFromGlb`) in place of the auto-generated capsule mesh, and wires up a
`CharacterAnimationController` (as a child of the returned entity - see
`CharacterController3dEntity.addChildren`) to drive idle/walk/run/crouch/jump switching
automatically, using the character's own `isGrounded`/`isCrouching`/`isRunning`/`moveDirection`
state - no extra app code needed for either. Ignored (with the rest of `display`) if there's no
visual scene.

**Signature**

```ts
export interface PlayerModel3DSettings {
  /** Path (URL or path prefix, without extension) to the `.glb` file - passed straight through to
   * `loadFromGlb`. */
  path: string
  /**
   * Local offset applied to the loaded model relative to the capsule's own center - see
   * `LoadGlbOptions.offset`. Defaults to `-(radius + centersDistance / 2)` along `up` (the
   * capsule's own bottom), matching a model authored with its origin at the feet, the common case
   * for a character rig. Set explicitly (e.g. `Pnt3.O`) for a model already authored with its
   * origin at the capsule's center.
   */
  offset?: Point3
  /** See `CharacterAnimationClipMap` - maps a built-in animation state to this model's own clip
   * name, for a model whose clips aren't already named `"idle"`/`"walk"`/`"run"`/`"crouch"`/
   * `"jump"`. */
  animations?: CharacterAnimationClipMap
  /** Crossfade duration (seconds) applied on every animation state switch. Default 0.2. */
  fadeDuration?: number
  /** See `CharacterAnimationControllerOptions.groundedTransitionDelay` - how long `isGrounded` must
   * hold steady before the animation state trusts it, to avoid flickering between a grounded state
   * and `"jump"` while standing at an edge. Default 0.15. */
  groundedTransitionDelay?: number
}
```

## Primitive3DSettings (interface)

Settings shared by every primitive entity (Box, Sphere, Plane, Capsule, Cylinder, Cone, Compound,
ConvexHull, Mesh)

**Signature**

```ts
export interface Primitive3DSettings extends Primitive3DShapeSettings {
  /**
   * Position of the primitive
   */
  position?: Point3

  /**
   * Rotation of the primitive
   */
  rotation?: Point4

  /**
   * Material options for the primitive
   */
  material?: DisplayObject3dOpts<any>

  /**
   * Physics body options, merged over sensible defaults
   */
  body?: Partial<Body3DOptions>

  /**
   * Initial linear velocity, applied once right after the body is created (a physics-only
   * property, only meaningful for a dynamic/kinematic_vel body - has no lasting effect on a
   * static/kinematic_pos one). Left unset entirely (not just omitted) means the body starts at
   * rest, same as not setting it at all.
   */
  linearVelocity?: Point3

  /** Initial angular velocity - see `linearVelocity`'s own doc, same caveats. */
  angularVelocity?: Point3
}
```

## Primitive3DShapeName (type alias)

Shape names accepted by the built-in `"Primitive"` entity class in a 3D level JSON, via the
sibling `shape` field on the entity (e.g. `{ class: "Primitive", shape: "BOX" }`) - the same
`Shape3DDescriptor['shape']` values used at the engine API level, so no translation is needed
between a level JSON and `Gg3dWorld.addPrimitiveRigidBody`.

**Signature**

```ts
export type Primitive3DShapeName = Shape3DDescriptor['shape']
```

## Primitive3DShapeSettings (interface)

The shape-selecting fields shared by `Primitive3DSettings` and a `COMPOUND` primitive's own
`children` entries - `shape` plus every field any shape variant needs (each optional, since
which ones are actually required depends on `shape` - see `buildShapeDescriptor`).

**Signature**

```ts
export interface Primitive3DShapeSettings {
  /**
   * Which primitive shape to construct
   */
  shape: Primitive3DShapeName

  /**
   * Dimensions of the primitive (for Box)
   */
  dimensions?: Point3

  /**
   * Radius of the primitive (for Sphere, Capsule, Cylinder, Cone)
   */
  radius?: number

  /**
   * Elliptical cross-section radius along local X, as an alternative to `radius` (Cylinder only).
   * Must be given together with `radiusY`.
   */
  radiusX?: number

  /**
   * Elliptical cross-section radius along local Y, as an alternative to `radius` (Cylinder only).
   * Must be given together with `radiusX`.
   */
  radiusY?: number

  /**
   * Height of the primitive (for Cylinder, Cone)
   */
  height?: number

  /**
   * Centers distance of the primitive (for Capsule)
   */
  centersDistance?: number

  /**
   * Child shapes making up a Compound primitive, each with its own local `position`/`rotation`
   * offset. A child's `shape` may itself be `"COMPOUND"`, nesting arbitrarily deep.
   */
  children?: CompoundChild3DSettings[]

  /**
   * Vertices of the primitive (for ConvexHull, Mesh)
   */
  vertices?: Point3[]

  /**
   * Triangle faces, as vertex-index triples into `vertices` (for Mesh)
   */
  faces?: [number, number, number][]
}
```

## Sound3DSettings (interface)

Settings for the built-in `"Sound"` entity class: loads a clip (via `audioScene.factory
.loadClip`) and builds a ready-to-use `AudioSource3dEntity`, positioned like any other level
entity. Covers `AudioSource3dEntity`'s "static" and "ambient/level music" placement modes -
"attached" (riding another entity's transform) isn't expressible in a level JSON, since JSON
has no way to reference a not-yet-loaded entity; wire that up in app code instead, the same way
a `"GgCar"` wheel's visual mesh or a `"Player"`'s input controller is - see
`gg-engine-level-json`. `playOneShot`-style transient sounds aren't a level entity at all
(there's nothing static to declare) - trigger them from a `"PlaySound"` blueprint node instead
(see `EntityJson.events`).

**Signature**

```ts
export interface Sound3DSettings {
  /** Position of the sound source. */
  position?: Point3

  /** Rotation of the sound source - only meaningful with a directional cone (`coneOuterAngle` on the source). */
  rotation?: Point4

  /** URL of the clip to load. */
  path: string

  /** Whether to loop. Defaults to `true` - static/ambient sounds are normally continuous. */
  loop?: boolean

  volume?: number
  playbackRate?: number

  /** Positional 3D audio vs. flat/non-positional (ambient bed, level music, UI). Defaults to `true`. */
  spatial?: boolean

  /** Output bus/category (e.g. `"sfx"`, `"music"`, `"ambient"`). Defaults to `"sfx"`. */
  bus?: string

  /** Whether to start playing as soon as the level loads. Defaults to `true`. */
  autoplay?: boolean

  refDistance?: number
  maxDistance?: number
  rolloffFactor?: number
  distanceModel?: AudioDistanceModel
}
```

## Trigger3DSettings (interface)

Settings for a trigger entity

**Signature**

```ts
export interface Trigger3DSettings {
  /**
   * Position of the trigger
   */
  position?: Point3

  /**
   * Rotation of the trigger
   */
  rotation?: Point4

  /**
   * Dimensions of the trigger
   */
  dimensions: Point3
}
```
