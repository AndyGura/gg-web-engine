---
title: rapier2d/components/rapier-2d-world.component.ts
nav_order: 118
parent: Modules
---

## rapier-2d-world.component overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [Rapier2dWorldComponent (class)](#rapier2dworldcomponent-class)
    - [init (method)](#init-method)
    - [simulate (method)](#simulate-method)
    - [registerCollisionGroup (method)](#registercollisiongroup-method)
    - [deregisterCollisionGroup (method)](#deregistercollisiongroup-method)
    - [raycast (method)](#raycast-method)
    - [dispose (method)](#dispose-method)
    - [added$ (property)](#added-property)
    - [removed$ (property)](#removed-property)
    - [children (property)](#children-property)
    - [mainCollisionGroup (property)](#maincollisiongroup-property)
    - [\_nativeWorld (property)](#_nativeworld-property)
    - [handleIdEntityMap (property)](#handleidentitymap-property)
    - [lockedCollisionGroups (property)](#lockedcollisiongroups-property)

---

# utils

## Rapier2dWorldComponent (class)

**Signature**

```ts
export declare class Rapier2dWorldComponent {
  constructor()
}
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

### raycast (method)

**Signature**

```ts
raycast(options: RaycastOptions<Point2>): RaycastResult<Point2, Rapier2dRigidBodyComponent>
```

### dispose (method)

**Signature**

```ts
dispose(): void
```

### added$ (property)

**Signature**

```ts
readonly added$: any
```

### removed$ (property)

**Signature**

```ts
readonly removed$: any
```

### children (property)

**Signature**

```ts
readonly children: Rapier2dRigidBodyComponent[]
```

### mainCollisionGroup (property)

**Signature**

```ts
readonly mainCollisionGroup: any
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
