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
  - [AmmoSceneTypeDoc (type alias)](#ammoscenetypedoc-type-alias)
  - [AmmoTypeDoc (type alias)](#ammotypedoc-type-alias)

---

# utils

## AmmoGgWorld (type alias)

**Signature**

```ts
export type AmmoGgWorld = Gg3dWorld<AmmoTypeDoc, AmmoSceneTypeDoc>
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

## AmmoSceneTypeDoc (type alias)

**Signature**

```ts
export type AmmoSceneTypeDoc = Gg3dWorldSceneTypeDocPPatch<AmmoPhysicsTypeDocRepo, AmmoWorldComponent>
```

## AmmoTypeDoc (type alias)

**Signature**

```ts
export type AmmoTypeDoc = Gg3dWorldTypeDocPPatch<AmmoPhysicsTypeDocRepo>
```
