---
title: rapier3d/types.ts
nav_order: 129
parent: Modules
---

## types overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [Rapier3dGgWorld (type alias)](#rapier3dggworld-type-alias)
  - [Rapier3dPhysicsTypeDocRepo (type alias)](#rapier3dphysicstypedocrepo-type-alias)

---

# utils

## Rapier3dGgWorld (type alias)

**Signature**

```ts
export type Rapier3dGgWorld = Gg3dWorld<
  Gg3dWorldTypeDocPPatch<Rapier3dPhysicsTypeDocRepo>,
  Gg3dWorldSceneTypeDocPPatch<Rapier3dPhysicsTypeDocRepo, Rapier3dWorldComponent>
>
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
