---
title: core/2d/level-loader.ts
nav_order: 27
parent: Modules
---

## level-loader overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [Gg2dLevelLoader (class)](#gg2dlevelloader-class)
    - [registerDefaultClasses (method)](#registerdefaultclasses-method)
    - [buildShapeDescriptor (method)](#buildshapedescriptor-method)
    - [createPrimitive (method)](#createprimitive-method)
    - [createTrigger (method)](#createtrigger-method)
  - [Primitive2DShapeName (type alias)](#primitive2dshapename-type-alias)
  - [PrimitiveSettings (interface)](#primitivesettings-interface)
  - [TriggerSettings (interface)](#triggersettings-interface)

---

# utils

## Gg2dLevelLoader (class)

2D level loader: registers the built-in primitive/trigger entity classes and dispatches
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

### buildShapeDescriptor (method)

Turn a `PrimitiveSettings` (`shape` plus shape-specific fields) into the `Shape2DDescriptor`
consumed by `Gg2dWorld.addPrimitiveRigidBody`.

**Signature**

```ts
private buildShapeDescriptor(settings: PrimitiveSettings): Shape2DDescriptor
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

## Primitive2DShapeName (type alias)

Shape names accepted by the built-in `"Primitive"` entity class in a 2D level JSON, via the
sibling `shape` field on the entity (e.g. `{ class: "Primitive", shape: "SQUARE" }`) - the same
`Shape2DDescriptor['shape']` values used at the engine API level, so no translation is needed
between a level JSON and `Gg2dWorld.addPrimitiveRigidBody`.

**Signature**

```ts
export type Primitive2DShapeName = Shape2DDescriptor['shape']
```

## PrimitiveSettings (interface)

Settings shared by every primitive entity (Square, Circle, ...)

**Signature**

```ts
export interface PrimitiveSettings {
  /**
   * Which primitive shape to construct
   */
  shape: Primitive2DShapeName

  /**
   * Position of the primitive
   */
  position?: Point2

  /**
   * Rotation of the primitive in radians
   */
  rotation?: number

  /**
   * Dimensions of the primitive (for Square)
   */
  dimensions?: Point2

  /**
   * Radius of the primitive (for Circle)
   */
  radius?: number

  /**
   * Material options for the primitive
   */
  material?: DisplayObject2dOpts<any>

  /**
   * Physics body options, merged over sensible defaults
   */
  body?: Partial<Body2DOptions>
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
