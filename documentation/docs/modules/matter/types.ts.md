---
title: matter/types.ts
nav_order: 118
parent: Modules
---

## types overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [MatterGgWorld (type alias)](#matterggworld-type-alias)
  - [MatterPhysicsTypeDocRepo (type alias)](#matterphysicstypedocrepo-type-alias)
  - [MatterSceneTypeDoc (type alias)](#matterscenetypedoc-type-alias)
  - [MatterTypeDoc (type alias)](#mattertypedoc-type-alias)

---

# utils

## MatterGgWorld (type alias)

**Signature**

```ts
export type MatterGgWorld = Gg2dWorld<MatterTypeDoc, MatterSceneTypeDoc>
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

## MatterSceneTypeDoc (type alias)

**Signature**

```ts
export type MatterSceneTypeDoc = Gg2dWorldSceneTypeDocPPatch<MatterPhysicsTypeDocRepo, MatterWorldComponent>
```

## MatterTypeDoc (type alias)

**Signature**

```ts
export type MatterTypeDoc = Gg2dWorldTypeDocPPatch<MatterPhysicsTypeDocRepo>
```
