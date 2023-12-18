---
title: rapier3d/components/rapier-3d-world.component.ts
nav_order: 118
parent: Modules
---

## rapier-3d-world.component overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [Rapier3dWorldComponent (class)](#rapier3dworldcomponent-class)
    - [init (method)](#init-method)
    - [simulate (method)](#simulate-method)
    - [registerCollisionGroup (method)](#registercollisiongroup-method)
    - [deregisterCollisionGroup (method)](#deregistercollisiongroup-method)
    - [startDebugger (method)](#startdebugger-method)
    - [stopDebugger (method)](#stopdebugger-method)
    - [dispose (method)](#dispose-method)
    - [\_nativeWorld (property)](#_nativeworld-property)
    - [handleIdEntityMap (property)](#handleidentitymap-property)
    - [lockedCollisionGroups (property)](#lockedcollisiongroups-property)

---

# utils

## Rapier3dWorldComponent (class)

**Signature**

```ts
export declare class Rapier3dWorldComponent
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

### registerCollisionGroup (method)

**Signature**

```ts
registerCollisionGroup(): CollisionGroup
```

### deregisterCollisionGroup (method)

**Signature**

```ts
deregisterCollisionGroup(group: CollisionGroup): void
```

### startDebugger (method)

**Signature**

```ts
startDebugger(world: Gg3dWorld, drawer: IDebugPhysicsDrawer<Point3, Point4>): void
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

### lockedCollisionGroups (property)

**Signature**

```ts
lockedCollisionGroups: number[]
```
