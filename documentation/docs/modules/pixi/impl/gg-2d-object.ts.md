---
title: pixi/impl/gg-2d-object.ts
nav_order: 71
parent: Modules
---

## gg-2d-object overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [Gg2dObject (class)](#gg2dobject-class)
    - [isEmpty (method)](#isempty-method)
    - [popChild (method)](#popchild-method)
    - [getBoundings (method)](#getboundings-method)
    - [clone (method)](#clone-method)
    - [addToWorld (method)](#addtoworld-method)
    - [removeFromWorld (method)](#removefromworld-method)
    - [dispose (method)](#dispose-method)
    - [name (property)](#name-property)

---

# utils

## Gg2dObject (class)

**Signature**

```ts
export declare class Gg2dObject {
  constructor(public nativeSprite: DisplayObject)
}
```

### isEmpty (method)

**Signature**

```ts
public isEmpty(): boolean
```

### popChild (method)

**Signature**

```ts
popChild(name: string): Gg2dObject | null
```

### getBoundings (method)

**Signature**

```ts
getBoundings(): GgBox2d
```

### clone (method)

**Signature**

```ts
clone(): Gg2dObject
```

### addToWorld (method)

**Signature**

```ts
addToWorld(world: Gg2dVisualScene): void
```

### removeFromWorld (method)

**Signature**

```ts
removeFromWorld(world: Gg2dVisualScene): void
```

### dispose (method)

**Signature**

```ts
dispose(): void
```

### name (property)

**Signature**

```ts
name: string
```
