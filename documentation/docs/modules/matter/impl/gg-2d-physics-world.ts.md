---
title: matter/impl/gg-2d-physics-world.ts
nav_order: 73
parent: Modules
---

## gg-2d-physics-world overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [Gg2dPhysicsWorld (class)](#gg2dphysicsworld-class)
    - [init (method)](#init-method)
    - [simulate (method)](#simulate-method)
    - [startDebugger (method)](#startdebugger-method)
    - [stopDebugger (method)](#stopdebugger-method)
    - [dispose (method)](#dispose-method)
    - [matterEngine (property)](#matterengine-property)
    - [factory (property)](#factory-property)

---

# utils

## Gg2dPhysicsWorld (class)

**Signature**

```ts
export declare class Gg2dPhysicsWorld
```

### init (method)

**Signature**

```ts
async init(): Promise<void>
```

### simulate (method)

**Signature**

```ts
simulate(delta: number): void
```

### startDebugger (method)

**Signature**

```ts
startDebugger(world: Gg2dWorld, drawer: GgDebugPhysicsDrawer<Point2, number>): void
```

### stopDebugger (method)

**Signature**

```ts
stopDebugger(): void
```

### dispose (method)

**Signature**

```ts
dispose(): void
```

### matterEngine (property)

**Signature**

```ts
matterEngine: any
```

### factory (property)

**Signature**

```ts
readonly factory: Gg2dBodyFactory
```
