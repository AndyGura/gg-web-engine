---
title: rapier3d/types.ts
nav_order: 140
parent: Modules
---

## types overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [Rapier3dGgWorld (type alias)](#rapier3dggworld-type-alias)
  - [Rapier3dPhysicsTypeDocRepo (type alias)](#rapier3dphysicstypedocrepo-type-alias)
  - [Rapier3dSceneTypeDoc (type alias)](#rapier3dscenetypedoc-type-alias)
  - [Rapier3dTypeDoc (type alias)](#rapier3dtypedoc-type-alias)

---

# utils

## Rapier3dGgWorld (type alias)

**Signature**

```ts
export type Rapier3dGgWorld = Gg3dWorld<Rapier3dTypeDoc, Rapier3dSceneTypeDoc>
```

## Rapier3dPhysicsTypeDocRepo (type alias)

**Signature**

```ts
export type Rapier3dPhysicsTypeDocRepo = {
  factory: Rapier3dFactory
  loader: Rapier3dLoader
  rigidBody: Rapier3dRigidBodyComponent
  trigger: Rapier3dTriggerComponent
  raycastVehicle: never //Rapier3dRaycastVehicleComponent;
}
```

## Rapier3dSceneTypeDoc (type alias)

**Signature**

```ts
export type Rapier3dSceneTypeDoc = Gg3dWorldSceneTypeDocPPatch<Rapier3dPhysicsTypeDocRepo, Rapier3dWorldComponent>
```

## Rapier3dTypeDoc (type alias)

**Signature**

```ts
export type Rapier3dTypeDoc = Gg3dWorldTypeDocPPatch<Rapier3dPhysicsTypeDocRepo>
```
