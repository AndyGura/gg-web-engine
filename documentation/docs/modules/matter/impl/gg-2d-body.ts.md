---
title: matter/impl/gg-2d-body.ts
nav_order: 71
parent: Modules
---

## gg-2d-body overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [Gg2dBody (class)](#gg2dbody-class)
    - [clone (method)](#clone-method)
    - [addToWorld (method)](#addtoworld-method)
    - [removeFromWorld (method)](#removefromworld-method)
    - [dispose (method)](#dispose-method)
    - [resetMotion (method)](#resetmotion-method)
    - [name (property)](#name-property)
    - [entity (property)](#entity-property)

---

# utils

## Gg2dBody (class)

**Signature**

```ts
export declare class Gg2dBody {
  constructor(public nativeBody: Body)
}
```

### clone (method)

**Signature**

```ts
clone(): Gg2dBody
```

### addToWorld (method)

**Signature**

```ts
addToWorld(world: Gg2dPhysicsWorld): void
```

### removeFromWorld (method)

**Signature**

```ts
removeFromWorld(world: Gg2dPhysicsWorld): void
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

### name (property)

**Signature**

```ts
name: string
```

### entity (property)

**Signature**

```ts
entity: any
```
