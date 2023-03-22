---
title: ammo/impl/bodies/gg-3d-trigger.ts
nav_order: 5
parent: Modules
---

## gg-3d-trigger overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [Gg3dTrigger (class)](#gg3dtrigger-class)
    - [checkOverlaps (method)](#checkoverlaps-method)
    - [clone (method)](#clone-method)
    - [addToWorld (method)](#addtoworld-method)
    - [removeFromWorld (method)](#removefromworld-method)
    - [dispose (method)](#dispose-method)
    - [resetMotion (method)](#resetmotion-method)
    - [entity (property)](#entity-property)

---

# utils

## Gg3dTrigger (class)

**Signature**

```ts
export declare class Gg3dTrigger {
  constructor(protected readonly world: Gg3dPhysicsWorld, protected _nativeBody: Ammo.btPairCachingGhostObject)
}
```

### checkOverlaps (method)

**Signature**

```ts
checkOverlaps(): void
```

### clone (method)

**Signature**

```ts
clone(): Gg3dTrigger
```

### addToWorld (method)

**Signature**

```ts
addToWorld(world: Gg3dPhysicsWorld)
```

### removeFromWorld (method)

**Signature**

```ts
removeFromWorld(world: Gg3dPhysicsWorld): void
```

### dispose (method)

**Signature**

```ts
dispose(): void
```

### resetMotion (method)

**Signature**

```ts
resetMotion(): void
```

### entity (property)

**Signature**

```ts
entity: any
```
