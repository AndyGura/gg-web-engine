---
title: matter/components/matter-world.component.ts
nav_order: 106
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
    - [raycast (method)](#raycast-method)
    - [dispose (method)](#dispose-method)
    - [matterEngine\_ (property)](#matterengine_-property)
    - [factory (property)](#factory-property)
    - [added$ (property)](#added-property)
    - [removed$ (property)](#removed-property)
    - [children (property)](#children-property)
    - [mainCollisionGroup (property)](#maincollisiongroup-property)
    - [lockedCollisionGroups (property)](#lockedcollisiongroups-property)

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

### raycast (method)

**Signature**

```ts
raycast(options: RaycastOptions<Point2>): RaycastResult<Point2, MatterRigidBodyComponent>
```

### dispose (method)

**Signature**

```ts
dispose(): void
```

### matterEngine\_ (property)

**Signature**

```ts
matterEngine_: any
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
readonly children: (MatterRigidBodyComponent | MatterTriggerComponent)[]
```

### mainCollisionGroup (property)

**Signature**

```ts
readonly mainCollisionGroup: any
```

### lockedCollisionGroups (property)

**Signature**

```ts
lockedCollisionGroups: number[]
```
