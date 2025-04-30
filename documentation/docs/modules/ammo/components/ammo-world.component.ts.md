---
title: ammo/components/ammo-world.component.ts
nav_order: 9
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
    - [dispose (method)](#dispose-method)
    - [afterTick$ (property)](#aftertick-property)
    - [added$ (property)](#added-property)
    - [removed$ (property)](#removed-property)
    - [children (property)](#children-property)
    - [mainCollisionGroup (property)](#maincollisiongroup-property)
    - [maxSubSteps (property)](#maxsubsteps-property)
    - [fixedTimeStep (property)](#fixedtimestep-property)
    - [\_dynamicAmmoWorld (property)](#_dynamicammoworld-property)
    - [lockedCollisionGroups (property)](#lockedcollisiongroups-property)

---

# utils

## AmmoWorldComponent (class)

**Signature**

```ts
export declare class AmmoWorldComponent {
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

### dispose (method)

**Signature**

```ts
dispose(): void
```

### afterTick$ (property)

**Signature**

```ts
readonly afterTick$: any
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
readonly children: (AmmoRigidBodyComponent | AmmoTriggerComponent)[]
```

### mainCollisionGroup (property)

**Signature**

```ts
readonly mainCollisionGroup: any
```

### maxSubSteps (property)

**Signature**

```ts
maxSubSteps: number | undefined
```

### fixedTimeStep (property)

**Signature**

```ts
fixedTimeStep: number | undefined
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
