---
title: ammo/types.ts
nav_order: 10
parent: Modules
---

## types overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [AmmoGgWorld (type alias)](#ammoggworld-type-alias)
  - [AmmoPhysicsTypeDocRepo (type alias)](#ammophysicstypedocrepo-type-alias)

---

# utils

## AmmoGgWorld (type alias)

**Signature**

```ts
export type AmmoGgWorld = Gg3dWorld<
  Gg3dWorldTypeDocPPatch<AmmoPhysicsTypeDocRepo>,
  Gg3dWorldSceneTypeDocPPatch<AmmoPhysicsTypeDocRepo, AmmoWorldComponent>
>
```

## AmmoPhysicsTypeDocRepo (type alias)

**Signature**

```ts
export type AmmoPhysicsTypeDocRepo = {
  factory: AmmoFactory
  loader: AmmoLoader
  rigidBody: AmmoRigidBodyComponent
  trigger: AmmoTriggerComponent
  raycastVehicle: AmmoRaycastVehicleComponent
}
```
