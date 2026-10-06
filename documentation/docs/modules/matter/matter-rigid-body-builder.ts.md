---
title: matter/matter-rigid-body-builder.ts
nav_order: 179
parent: Modules
---

## matter-rigid-body-builder overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [buildMatterRigidBody](#buildmatterrigidbody)
  - [buildMatterTriggerBody](#buildmattertriggerbody)
  - [createShapeBody](#createshapebody)

---

# utils

## buildMatterRigidBody

Builds a rigid body for `MatterFactory.createRigidBody`. A plain function because building one
never needs the world (it's added to one later, in `addToWorld`), which lets
`MatterRigidBodyComponent.clone()` rebuild its body from its own shape and options without a
factory instance at hand, and without importing the factory module: that module imports
`MatterTriggerComponent`, which extends `MatterRigidBodyComponent`, so importing it from the
rigid body's own module is a circular import that breaks the `extends`.

**Signature**

```ts
export declare function buildMatterRigidBody(
  descriptor: BodyShape2DDescriptor,
  transform?: {
    position?: Point2
    rotation?: number
  }
): MatterRigidBodyComponent
```

## buildMatterTriggerBody

Builds the sensor body of a trigger, for `MatterFactory.createTrigger` and
`MatterTriggerComponent.clone()`.

**Signature**

```ts
export declare function buildMatterTriggerBody(
  shape: Shape2DDescriptor,
  transform?: {
    position?: Point2
    rotation?: number
  }
): Body
```

## createShapeBody

**Signature**

```ts
export declare function createShapeBody(shape: Shape2DDescriptor, options: IChamferableBodyDefinition): Body
```
