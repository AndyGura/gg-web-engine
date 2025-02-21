---
title: core/3d/entities/surface-following.entity.ts
nav_order: 48
parent: Modules
---

## surface-following.entity overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [SurfaceFollowFunc (type alias)](#surfacefollowfunc-type-alias)
  - [SurfaceFollowingEntity (class)](#surfacefollowingentity-class)
    - [setupCollider (method)](#setupcollider-method)
    - [addCollider (method)](#addcollider-method)
    - [removeCollider (method)](#removecollider-method)
    - [onSpawned (method)](#onspawned-method)
    - [updateDebugView (method)](#updatedebugview-method)
    - [onRemoved (method)](#onremoved-method)
    - [positionPlanes (method)](#positionplanes-method)
    - [tickOrder (property)](#tickorder-property)
    - [debugBodySettings (property)](#debugbodysettings-property)
  - [SurfaceFollowingEntityDebugSettings (class)](#surfacefollowingentitydebugsettings-class)

---

# utils

## SurfaceFollowFunc (type alias)

Represents a function that calculates the surface position and normal
for a given point in 3D space.

**Signature**

```ts
export type SurfaceFollowFunc = (p: Point3) => { position: Point3; normal: Point3 }
```

## SurfaceFollowingEntity (class)

Represents an entity that follows a surface dynamically by adjusting
its position and orientation based on a given surface function.

**Signature**

```ts
export declare class SurfaceFollowingEntity<PTypeDoc> {
  constructor(
    /** Function that determines surface position and normal. */
    public followFunc: SurfaceFollowFunc,
    /** Optional body configuration. */
    protected bodyOptions: Partial<
      Omit<BodyOptions, 'dynamic' | 'mass' | 'ownCollisionGroups' | 'interactWithCollisionGroups'>
    > = {}
  )
}
```

### setupCollider (method)

Sets up a collider by assigning it a collision group and a dynamic plane.

**Signature**

```ts
private setupCollider(collider: PTypeDoc['rigidBody'])
```

### addCollider (method)

Adds a collider to the entity, registering it immediately if the entity
is already in a world.

**Signature**

```ts
addCollider(collider: PTypeDoc['rigidBody'])
```

### removeCollider (method)

Removes a collider and deregisters its associated collision group.

**Signature**

```ts
removeCollider(collider: PTypeDoc['rigidBody'])
```

### onSpawned (method)

Called when the entity is added to a world.

**Signature**

```ts
onSpawned(world: Gg3dWorld<VisualTypeDocRepo3D, PTypeDoc>)
```

### updateDebugView (method)

Updates debug visualization if active.

**Signature**

```ts
private updateDebugView()
```

### onRemoved (method)

Called when the entity is removed from the world.

**Signature**

```ts
onRemoved()
```

### positionPlanes (method)

Positions planes based on the surface-follow function.

**Signature**

```ts
protected positionPlanes()
```

### tickOrder (property)

Determines the execution order for physics simulation.

**Signature**

```ts
readonly tickOrder: number
```

### debugBodySettings (property)

Debugging settings for the surface-following entity.

**Signature**

```ts
readonly debugBodySettings: SurfaceFollowingEntityDebugSettings
```

## SurfaceFollowingEntityDebugSettings (class)

Stores debug settings for a SurfaceFollowingEntity, allowing customization
of the debug mesh.

**Signature**

```ts
export declare class SurfaceFollowingEntityDebugSettings {
  constructor(
    private _hexMeshStepDistance: number = 4,
    private _hexMeshDepth: number = 6,
    private _customGlobalShape: Shape3DDescriptor | null = null
  )
}
```
