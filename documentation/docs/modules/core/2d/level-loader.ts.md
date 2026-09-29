---
title: core/2d/level-loader.ts
nav_order: 37
parent: Modules
---

## level-loader overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [CompoundChild2DSettings (interface)](#compoundchild2dsettings-interface)
  - [Gg2dLevelLoader (class)](#gg2dlevelloader-class)
    - [registerDefaultClasses (method)](#registerdefaultclasses-method)
    - [serializePrimitive (method)](#serializeprimitive-method)
    - [serializeTrigger (method)](#serializetrigger-method)
    - [buildShapeDescriptor (method)](#buildshapedescriptor-method)
    - [createPrimitive (method)](#createprimitive-method)
    - [createTrigger (method)](#createtrigger-method)
    - [createSound (method)](#createsound-method)
  - [Primitive2DShapeName (type alias)](#primitive2dshapename-type-alias)
  - [Primitive2DShapeSettings (interface)](#primitive2dshapesettings-interface)
  - [PrimitiveSettings (interface)](#primitivesettings-interface)
  - [Sound2DSettings (interface)](#sound2dsettings-interface)
  - [TriggerSettings (interface)](#triggersettings-interface)

---

# utils

## CompoundChild2DSettings (interface)

One child of a `COMPOUND` primitive's `children` - the same shape-selecting fields as
`PrimitiveSettings`, plus its own local `position`/`rotation` offset, but no `material`/`body`
(a compound's children share one physics body and one display object, set on the parent
`"Primitive"` entity only).

**Signature**

```ts
export interface CompoundChild2DSettings extends Primitive2DShapeSettings {
  /**
   * Position of the child shape, relative to the compound's own origin
   */
  position?: Point2

  /**
   * Rotation of the child shape in radians, relative to the compound's own rotation
   */
  rotation?: number
}
```

## Gg2dLevelLoader (class)

2D level loader: registers the built-in primitive/trigger/sound entity classes and dispatches
`LevelJson` entities to them (or to custom classes registered via `registerClass`).

**Signature**

```ts
export declare class Gg2dLevelLoader<TypeDoc> {
  constructor(protected readonly world: Gg2dWorld<TypeDoc>)
}
```

### registerDefaultClasses (method)

Register the built-in classes for primitives and triggers

**Signature**

```ts
private registerDefaultClasses(): void
```

### serializePrimitive (method)

Live serializer for the built-in `"Primitive"` class - see the 3D loader's
`Gg3dLevelLoader.serializePrimitive` for the general approach and rationale (identical here,
just 2D-typed): matches `entity.constructor === Entity2d` exactly, recovers shape/dimensions
from `objectBody.debugBodySettings.shape`, `body`/velocity from the live physics body
(`objectBody.bodyOptions`/`.linearVelocity`/`.angularVelocity`), and `material` from
`object2D` when it implements `IMaterialReadable2dComponent`.

**Signature**

```ts
private serializePrimitive(entity: IEntity<Point2, number, TypeDoc>): EntityJson | undefined
```

### serializeTrigger (method)

Live serializer for the built-in `"Trigger"` class - see the 3D loader's own doc for the
general approach. Matches `entity.constructor === Trigger2dEntity` exactly.

**Signature**

```ts
private serializeTrigger(entity: IEntity<Point2, number, TypeDoc>): EntityJson | undefined
```

### buildShapeDescriptor (method)

Turn a `Primitive2DShapeSettings` (`shape` plus shape-specific fields) into the
`Shape2DDescriptor` consumed by `Gg2dWorld.addPrimitiveRigidBody`. Used both for a
`"Primitive"` entity's own top-level settings and, recursively, for each of a `COMPOUND`
primitive's `children` (which may themselves be `COMPOUND`, nesting arbitrarily deep).

**Signature**

```ts
private buildShapeDescriptor(settings: Primitive2DShapeSettings): Shape2DDescriptor
```

### createPrimitive (method)

Create a primitive entity (both display object and physics body) from a shape descriptor

**Signature**

```ts
private createPrimitive(
    world: Gg2dWorld<TypeDoc>,
    shape: Shape2DDescriptor,
    settings: PrimitiveSettings,
  ): Entity2d<TypeDoc>
```

### createTrigger (method)

Create a trigger entity: a `Trigger2dEntity` wrapping the raw physics trigger component, so
the app can subscribe to `onEntityEntered`/`onEntityLeft` without any extra wiring - see the
base `LevelLoader` docs for how it's parented for level-lifecycle cleanup.

**Signature**

```ts
private createTrigger(
    world: Gg2dWorld<TypeDoc>,
    settings: TriggerSettings,
  ): Trigger2dEntity<TypeDoc['pTypeDoc']> | undefined
```

### createSound (method)

Create a `"Sound"` entity - see the 3D loader's `createSound` doc (identical behavior).

**Signature**

```ts
private async createSound(
    world: Gg2dWorld<TypeDoc>,
    settings: Sound2DSettings,
  ): Promise<AudioSource2dEntity<TypeDoc> | undefined>
```

## Primitive2DShapeName (type alias)

Shape names accepted by the built-in `"Primitive"` entity class in a 2D level JSON, via the
sibling `shape` field on the entity (e.g. `{ class: "Primitive", shape: "BOX" }`) - the same
`Shape2DDescriptor['shape']` values used at the engine API level, so no translation is needed
between a level JSON and `Gg2dWorld.addPrimitiveRigidBody`.

**Signature**

```ts
export type Primitive2DShapeName = Shape2DDescriptor['shape']
```

## Primitive2DShapeSettings (interface)

The shape-selecting fields shared by `PrimitiveSettings` and a `COMPOUND` primitive's own
`children` entries - `shape` plus every field any shape variant needs (each optional, since
which ones are actually required depends on `shape` - see `buildShapeDescriptor`).

**Signature**

```ts
export interface Primitive2DShapeSettings {
  /**
   * Which primitive shape to construct
   */
  shape: Primitive2DShapeName

  /**
   * Dimensions of the primitive (for Box)
   */
  dimensions?: Point2

  /**
   * Radius of the primitive (for Circle/Capsule)
   */
  radius?: number

  /**
   * Distance between the two hemisphere centers (for Capsule)
   */
  centersDistance?: number

  /**
   * Vertices of the primitive (for ConvexHull/Polygon)
   */
  vertices?: Point2[]

  /**
   * Child shapes making up a Compound primitive, each with its own local `position`/`rotation`
   * offset. A child's `shape` may itself be `"COMPOUND"`, nesting arbitrarily deep.
   */
  children?: CompoundChild2DSettings[]
}
```

## PrimitiveSettings (interface)

Settings shared by every primitive entity (Box, Circle, ...)

**Signature**

```ts
export interface PrimitiveSettings extends Primitive2DShapeSettings {
  /**
   * Position of the primitive
   */
  position?: Point2

  /**
   * Rotation of the primitive in radians
   */
  rotation?: number

  /**
   * Material options for the primitive
   */
  material?: DisplayObject2dOpts<any>

  /**
   * Physics body options, merged over sensible defaults
   */
  body?: Partial<Body2DOptions>

  /**
   * Initial linear velocity, applied once right after the body is created - see the 3D loader's
   * `Primitive3DSettings.linearVelocity` doc, same caveats.
   */
  linearVelocity?: Point2

  /** Initial angular velocity (radians/s) - see `linearVelocity`'s own doc, same caveats. */
  angularVelocity?: number
}
```

## Sound2DSettings (interface)

Settings for the built-in `"Sound"` entity class - see the 3D `Sound3DSettings` doc (identical
shape, `Point2`/no cone).

**Signature**

```ts
export interface Sound2DSettings {
  position?: Point2
  rotation?: number
  path: string
  loop?: boolean
  volume?: number
  playbackRate?: number
  spatial?: boolean
  bus?: string
  autoplay?: boolean
  refDistance?: number
  maxDistance?: number
  rolloffFactor?: number
  distanceModel?: AudioDistanceModel
}
```

## TriggerSettings (interface)

Settings for a trigger entity

**Signature**

```ts
export interface TriggerSettings {
  /**
   * Position of the trigger
   */
  position?: Point2

  /**
   * Rotation of the trigger in radians
   */
  rotation?: number

  /**
   * Dimensions of the trigger
   */
  dimensions: Point2
}
```
