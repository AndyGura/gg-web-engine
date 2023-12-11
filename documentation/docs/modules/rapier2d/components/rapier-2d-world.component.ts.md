---
title: rapier2d/components/rapier-2d-world.component.ts
nav_order: 107
parent: Modules
---

## rapier-2d-world.component overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [Rapier2dWorldComponent (class)](#rapier2dworldcomponent-class)
    - [init (method)](#init-method)
    - [simulate (method)](#simulate-method)
    - [startDebugger (method)](#startdebugger-method)
    - [stopDebugger (method)](#stopdebugger-method)
    - [dispose (method)](#dispose-method)
    - [\_nativeWorld (property)](#_nativeworld-property)
    - [handleIdEntityMap (property)](#handleidentitymap-property)

---

# utils

## Rapier2dWorldComponent (class)

**Signature**

```ts
export declare class Rapier2dWorldComponent
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
startDebugger(world: Gg2dWorld, drawer: IDebugPhysicsDrawer<Point2, number>): void
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

### \_nativeWorld (property)

**Signature**

```ts
_nativeWorld: any
```

### handleIdEntityMap (property)

**Signature**

```ts
readonly handleIdEntityMap: any
```
