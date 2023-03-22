---
title: core/2d/entities/gg-2d-entity.ts
nav_order: 10
parent: Modules
---

## gg-2d-entity overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [Gg2dEntity (class)](#gg2dentity-class)
    - [onSpawned (method)](#onspawned-method)
    - [onRemoved (method)](#onremoved-method)
    - [dispose (method)](#dispose-method)
    - [tick$ (property)](#tick-property)
    - [tickOrder (property)](#tickorder-property)

---

# utils

## Gg2dEntity (class)

**Signature**

```ts
export declare class Gg2dEntity {
  constructor(public readonly object2D: IGg2dObject | null, public readonly objectBody: IGg2dBody | null)
}
```

### onSpawned (method)

**Signature**

```ts
onSpawned(world: Gg2dWorld)
```

### onRemoved (method)

**Signature**

```ts
onRemoved()
```

### dispose (method)

**Signature**

```ts
dispose(): void
```

### tick$ (property)

**Signature**

```ts
readonly tick$: any
```

### tickOrder (property)

**Signature**

```ts
readonly tickOrder: 750
```
