---
title: ammo/components/ammo-world.component.ts
nav_order: 10
parent: Modules
---

## ammo-world.component overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [AmmoWorldComponent (class)](#ammoworldcomponent-class)
    - [init (method)](#init-method)
    - [simulate (method)](#simulate-method)
    - [registerCollisionGroup (method)](#registercollisiongroup-method)
    - [deregisterCollisionGroup (method)](#deregistercollisiongroup-method)
    - [startDebugger (method)](#startdebugger-method)
    - [stopDebugger (method)](#stopdebugger-method)
    - [dispose (method)](#dispose-method)
    - [afterTick$ (property)](#aftertick-property)
    - [\_dynamicAmmoWorld (property)](#_dynamicammoworld-property)
    - [lockedCollisionGroups (property)](#lockedcollisiongroups-property)

---

# utils

## AmmoWorldComponent (class)

**Signature**

```ts
export declare class AmmoWorldComponent
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
startDebugger(
    world: Gg3dWorld<VisualTypeDocRepo3D, AmmoPhysicsTypeDocRepo>,
    drawer: IDebugPhysicsDrawer<Point3, Point4>,
  ): void
```

### stopDebugger (method)

**Signature**

```ts
stopDebugger(world: Gg3dWorld<VisualTypeDocRepo3D, AmmoPhysicsTypeDocRepo>): void
```

### dispose (method)

**Signature**

```ts
dispose(): void
```

### afterTick$ (property)

**Signature**

```ts
afterTick$: any
```

### \_dynamicAmmoWorld (property)

**Signature**

```ts
_dynamicAmmoWorld: Ammo.btDiscreteDynamicsWorld | undefined
```

### lockedCollisionGroups (property)

**Signature**

```ts
lockedCollisionGroups: number[]
```
