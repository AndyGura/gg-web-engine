---
title: core/3d/entities/gg-3d-entity.ts
nav_order: 22
parent: Modules
---

## gg-3d-entity overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [Gg3dEntity (class)](#gg3dentity-class)
    - [runTransformBinding (method)](#runtransformbinding-method)
    - [onSpawned (method)](#onspawned-method)
    - [onRemoved (method)](#onremoved-method)
    - [dispose (method)](#dispose-method)
    - [tick$ (property)](#tick-property)
    - [tickOrder (property)](#tickorder-property)

---

# utils

## Gg3dEntity (class)

**Signature**

```ts
export declare class Gg3dEntity {
  constructor(public readonly object3D: IGg3dObject | null, public readonly objectBody: IGg3dBody | null = null)
}
```

### runTransformBinding (method)

**Signature**

```ts
protected runTransformBinding(objectBody: IGg3dBody, object3D: IGg3dObject): void
```

### onSpawned (method)

**Signature**

```ts
onSpawned(world: Gg3dWorld)
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