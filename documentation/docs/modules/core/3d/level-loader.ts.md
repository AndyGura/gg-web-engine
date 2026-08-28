---
title: core/3d/level-loader.ts
nav_order: 58
parent: Modules
---

## level-loader overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [Camera3DSettings (interface)](#camera3dsettings-interface)
  - [Gg3dLevelLoader (class)](#gg3dlevelloader-class)
    - [registerDefaultClasses (method)](#registerdefaultclasses-method)
    - [buildShapeDescriptor (method)](#buildshapedescriptor-method)
    - [createPrimitive (method)](#createprimitive-method)
    - [createTrigger (method)](#createtrigger-method)
    - [createCamera (method)](#createcamera-method)
    - [resolveWheelDisplay (method)](#resolvewheeldisplay-method)
    - [createGgCar (method)](#createggcar-method)
    - [createMapGraph (method)](#createmapgraph-method)
  - [GgCar3DCommonSettings (interface)](#ggcar3dcommonsettings-interface)
  - [GgCar3DSettings (type alias)](#ggcar3dsettings-type-alias)
  - [GgCarAxleSettings (type alias)](#ggcaraxlesettings-type-alias)
  - [GgCarSharedWheelSettings (type alias)](#ggcarsharedwheelsettings-type-alias)
  - [GgCarWheelDisplaySettings (interface)](#ggcarwheeldisplaysettings-interface)
  - [GgCarWheelSettings (type alias)](#ggcarwheelsettings-type-alias)
  - [MapGraph3DSettings (interface)](#mapgraph3dsettings-interface)
  - [MapGraphNodeJson (type alias)](#mapgraphnodejson-type-alias)
  - [Primitive3DSettings (interface)](#primitive3dsettings-interface)
  - [Primitive3DShapeName (type alias)](#primitive3dshapename-type-alias)
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

### registerDefaultClasses (method)

Register the built-in classes for primitives, triggers, and cameras

**Signature**

```ts
private registerDefaultClasses(): void
```

### buildShapeDescriptor (method)

Turn a `Primitive3DSettings` (`shape` plus shape-specific fields) into the `Shape3DDescriptor`
consumed by `Gg3dWorld.addPrimitiveRigidBody`.

**Signature**

```ts
private buildShapeDescriptor(settings: Primitive3DSettings): Shape3DDescriptor
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
which a level JSON has no way to do.

**Signature**

```ts
private createGgCar(world: Gg3dWorld<TypeDoc>, settings: GgCar3DSettings): GgCarEntity<TypeDoc> | undefined
```

### createMapGraph (method)

Create a `"MapGraph"` entity: a `MapGraph` built from plain node data (a flat/looped path or
a rectangular grid, see {@link MapGraph3DSettings}), wrapped in a ready-to-use
`MapGraph3dEntity`. The app still has to drive `loaderCursor$` itself once the level is
loaded - see `gg-engine-level-json`'s "MapGraph" section.

**Signature**

```ts
private createMapGraph(world: Gg3dWorld<TypeDoc>, settings: MapGraph3DSettings): MapGraph3dEntity<TypeDoc>
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
counterpart of the GLB-driven car construction apps do by hand (see `examples/fly-city-three-ammo`'s
`GameFactory.generateCar`), for a car whose chassis/wheels are plain primitives rather than
loaded meshes.

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

## Primitive3DSettings (interface)

Settings shared by every primitive entity (Box, Sphere, Plane, Capsule, Cylinder, Cone)

**Signature**

```ts
export interface Primitive3DSettings {
  /**
   * Which primitive shape to construct
   */
  shape: Primitive3DShapeName

  /**
   * Position of the primitive
   */
  position?: Point3

  /**
   * Rotation of the primitive
   */
  rotation?: Point4

  /**
   * Dimensions of the primitive (for Box)
   */
  dimensions?: Point3

  /**
   * Radius of the primitive (for Sphere, Capsule, Cylinder, Cone)
   */
  radius?: number

  /**
   * Height of the primitive (for Cylinder, Cone)
   */
  height?: number

  /**
   * Centers distance of the primitive (for Capsule)
   */
  centersDistance?: number

  /**
   * Material options for the primitive
   */
  material?: DisplayObject3dOpts<any>

  /**
   * Physics body options, merged over sensible defaults
   */
  body?: Partial<Body3DOptions>
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
