---
title: ammo/impl/gg-3d-physics-world.ts
nav_order: 8
parent: Modules
---

## gg-3d-physics-world overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [Gg3dPhysicsWorld (class)](#gg3dphysicsworld-class)
    - [init (method)](#init-method)
    - [simulate (method)](#simulate-method)
    - [startDebugger (method)](#startdebugger-method)
    - [stopDebugger (method)](#stopdebugger-method)
    - [dispose (method)](#dispose-method)

---

# utils

## Gg3dPhysicsWorld (class)

**Signature**

```ts
export declare class Gg3dPhysicsWorld
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
startDebugger(world: Gg3dWorld, drawer: GgDebugPhysicsDrawer<Point3, Point4>): void
```

### stopDebugger (method)

**Signature**

```ts
stopDebugger(world: Gg3dWorld): void
```

### dispose (method)

**Signature**

```ts
dispose(): void
```
