---
title: matter/types.ts
nav_order: 108
parent: Modules
---

## types overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [MatterGgWorld (type alias)](#matterggworld-type-alias)
  - [MatterPhysicsTypeDocRepo (type alias)](#matterphysicstypedocrepo-type-alias)

---

# utils

## MatterGgWorld (type alias)

**Signature**

```ts
export type MatterGgWorld = Gg2dWorld<
  Gg2dWorldTypeDocPPatch<MatterPhysicsTypeDocRepo>,
  Gg2dWorldSceneTypeDocPPatch<MatterPhysicsTypeDocRepo, MatterWorldComponent>
>
```

## MatterPhysicsTypeDocRepo (type alias)

**Signature**

```ts
export type MatterPhysicsTypeDocRepo = {
  factory: MatterFactory
  rigidBody: MatterRigidBodyComponent
  trigger: MatterTriggerComponent
}
```
