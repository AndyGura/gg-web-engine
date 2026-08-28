---
title: rapier2d/types.ts
nav_order: 132
parent: Modules
---

## types overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [Rapier2dGgWorld (type alias)](#rapier2dggworld-type-alias)
  - [Rapier2dPhysicsTypeDocRepo (type alias)](#rapier2dphysicstypedocrepo-type-alias)
  - [Rapier2dSceneTypeDoc (type alias)](#rapier2dscenetypedoc-type-alias)
  - [Rapier2dTypeDoc (type alias)](#rapier2dtypedoc-type-alias)

---

# utils

## Rapier2dGgWorld (type alias)

**Signature**

```ts
export type Rapier2dGgWorld = Gg2dWorld<Rapier2dTypeDoc, Rapier2dSceneTypeDoc>
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

## Rapier2dSceneTypeDoc (type alias)

**Signature**

```ts
export type Rapier2dSceneTypeDoc = Gg2dWorldSceneTypeDocPPatch<Rapier2dPhysicsTypeDocRepo, Rapier2dWorldComponent>
```

## Rapier2dTypeDoc (type alias)

**Signature**

```ts
export type Rapier2dTypeDoc = Gg2dWorldTypeDocPPatch<Rapier2dPhysicsTypeDocRepo>
```
