---
title: core/base/entities/i-renderer.entity.ts
nav_order: 76
parent: Modules
---

## i-renderer.entity overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [IRendererEntity (class)](#irendererentity-class)
    - [onSpawned (method)](#onspawned-method)
    - [dispose (method)](#dispose-method)
    - [tickOrder (property)](#tickorder-property)
    - [\_rendererSize$ (property)](#_renderersize-property)

---

# utils

## IRendererEntity (class)

Represents a base class for a renderer entity.

**Signature**

```ts
export declare class IRendererEntity<D, R, TypeDoc> {
  constructor(public readonly renderer: TypeDoc['renderer'])
}
```

### onSpawned (method)

**Signature**

```ts
onSpawned(world: GgWorld<D, R, TypeDoc>)
```

### dispose (method)

**Signature**

```ts
dispose()
```

### tickOrder (property)

**Signature**

```ts
readonly tickOrder: TickOrder.RENDERING
```

### \_rendererSize$ (property)

Represents the current size of the renderer.

**Signature**

```ts
_rendererSize$: any
```
