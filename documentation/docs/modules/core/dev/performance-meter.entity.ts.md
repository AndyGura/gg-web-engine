---
title: core/dev/performance-meter.entity.ts
nav_order: 101
parent: Modules
---

## performance-meter.entity overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [PerformanceMeterEntity (class)](#performancemeterentity-class)
    - [onSpawned (method)](#onspawned-method)
    - [onRemoved (method)](#onremoved-method)
    - [tickOrder (property)](#tickorder-property)

---

# utils

## PerformanceMeterEntity (class)

**Signature**

```ts
export declare class PerformanceMeterEntity {
  constructor(private readonly maxSamples = 60, private readonly maxRows = 15)
}
```

### onSpawned (method)

**Signature**

```ts
onSpawned(world: GgWorld<unknown, unknown>)
```

### onRemoved (method)

**Signature**

```ts
onRemoved()
```

### tickOrder (property)

**Signature**

```ts
readonly tickOrder: number
```
