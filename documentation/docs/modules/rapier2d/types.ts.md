---
title: rapier2d/types.ts
nav_order: 121
parent: Modules
---

## types overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [Rapier2dGgWorld (type alias)](#rapier2dggworld-type-alias)
  - [Rapier2dPhysicsTypeDocRepo (type alias)](#rapier2dphysicstypedocrepo-type-alias)

---

# utils

## Rapier2dGgWorld (type alias)

**Signature**

```ts
export type Rapier2dGgWorld = Gg2dWorld<
  Gg2dWorldTypeDocPPatch<Rapier2dPhysicsTypeDocRepo>,
  Gg2dWorldSceneTypeDocPPatch<Rapier2dPhysicsTypeDocRepo, Rapier2dWorldComponent>
>
```

## Rapier2dPhysicsTypeDocRepo (type alias)

**Signature**

```ts
export type Rapier2dPhysicsTypeDocRepo = {
  factory: Rapier2dFactory
  rigidBody: Rapier2dRigidBodyComponent
  trigger: Rapier2dTriggerComponent
}
```
