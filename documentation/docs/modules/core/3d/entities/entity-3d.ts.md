---
title: core/3d/entities/entity-3d.ts
nav_order: 78
parent: Modules
---

## entity-3d overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [Entity3d (class)](#entity3d-class)
    - [updateVisibility (method)](#updatevisibility-method)
    - [runTransformBinding (method)](#runtransformbinding-method)
    - [captureNetworkState (method)](#capturenetworkstate-method)
    - [applyNetworkState (method)](#applynetworkstate-method)
    - [tickOrder (property)](#tickorder-property)
    - [object3D (property)](#object3d-property)
    - [objectBody (property)](#objectbody-property)

---

# utils

## Entity3d (class)

**Signature**

```ts
export declare class Entity3d<TypeDoc> {
  constructor(options: {
    object3D?: TypeDoc['vTypeDoc']['displayObject'] | null
    objectBody?: TypeDoc['pTypeDoc']['rigidBody'] | null
  })
}
```

### updateVisibility (method)

**Signature**

```ts
public updateVisibility(): void
```

### runTransformBinding (method)

Synchronize physics body transform with entity (and mesh if defined)

**Signature**

```ts
protected runTransformBinding(objectBody: IRigidBody3dComponent, object3D: IDisplayObject3dComponent | null): void
```

### captureNetworkState (method)

`INetworkSyncable`: owner-side snapshot of `objectBody` - see `RigidBodyCorrection`.

**Signature**

```ts
public captureNetworkState(): RigidBodyNetState<Point3, Point4>
```

### applyNetworkState (method)

`INetworkSyncable`: replica-side correction of `objectBody` - see `RigidBodyCorrection`. No-op without a body.

**Signature**

```ts
public applyNetworkState(target: RigidBodyNetState<Point3, Point4>, ctx: NetworkApplyContext): CorrectionOutcome
```

### tickOrder (property)

**Signature**

```ts
readonly tickOrder: TickOrder.OBJECTS_BINDING
```

### object3D (property)

**Signature**

```ts
readonly object3D: TypeDoc["vTypeDoc"]["displayObject"] | null
```

### objectBody (property)

**Signature**

```ts
readonly objectBody: TypeDoc["pTypeDoc"]["rigidBody"] | null
```
