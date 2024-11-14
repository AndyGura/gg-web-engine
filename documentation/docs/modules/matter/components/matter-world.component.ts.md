---
title: matter/components/matter-world.component.ts
nav_order: 102
parent: Modules
---

## matter-world.component overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [MatterWorldComponent (class)](#matterworldcomponent-class)
    - [init (method)](#init-method)
    - [registerCollisionGroup (method)](#registercollisiongroup-method)
    - [deregisterCollisionGroup (method)](#deregistercollisiongroup-method)
    - [simulate (method)](#simulate-method)
    - [dispose (method)](#dispose-method)
    - [matterEngine (property)](#matterengine-property)
    - [factory (property)](#factory-property)
    - [added$ (property)](#added-property)
    - [removed$ (property)](#removed-property)
    - [children (property)](#children-property)

---

# utils

## MatterWorldComponent (class)

**Signature**

```ts
export declare class MatterWorldComponent {
  constructor()
}
```

### init (method)

**Signature**

```ts
async init(): Promise<void>
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

### simulate (method)

**Signature**

```ts
simulate(delta: number): void
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
readonly factory: MatterFactory
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
readonly children: MatterRigidBodyComponent[]
```
