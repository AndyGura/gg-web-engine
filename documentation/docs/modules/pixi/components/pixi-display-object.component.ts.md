---
title: pixi/components/pixi-display-object.component.ts
nav_order: 96
parent: Modules
---

## pixi-display-object.component overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [PixiDisplayObjectComponent (class)](#pixidisplayobjectcomponent-class)
    - [isEmpty (method)](#isempty-method)
    - [popChild (method)](#popchild-method)
    - [getBoundings (method)](#getboundings-method)
    - [clone (method)](#clone-method)
    - [addToWorld (method)](#addtoworld-method)
    - [removeFromWorld (method)](#removefromworld-method)
    - [dispose (method)](#dispose-method)
    - [entity (property)](#entity-property)
    - [name (property)](#name-property)

---

# utils

## PixiDisplayObjectComponent (class)

**Signature**

```ts
export declare class PixiDisplayObjectComponent {
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
popChild(name: string): PixiDisplayObjectComponent | null
```

### getBoundings (method)

**Signature**

```ts
getBoundings(): GgBox2d
```

### clone (method)

**Signature**

```ts
clone(): PixiDisplayObjectComponent
```

### addToWorld (method)

**Signature**

```ts
addToWorld(world: Gg2dWorld<PixiSceneComponent>): void
```

### removeFromWorld (method)

**Signature**

```ts
removeFromWorld(world: Gg2dWorld<PixiSceneComponent>): void
```

### dispose (method)

**Signature**

```ts
dispose(): void
```

### entity (property)

**Signature**

```ts
entity: any
```

### name (property)

**Signature**

```ts
name: string
```