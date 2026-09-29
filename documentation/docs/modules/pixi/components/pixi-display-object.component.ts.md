---
title: pixi/components/pixi-display-object.component.ts
nav_order: 155
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
    - [materialOptions (property)](#materialoptions-property)
    - [name (property)](#name-property)

---

# utils

## PixiDisplayObjectComponent (class)

**Signature**

```ts
export declare class PixiDisplayObjectComponent {
  constructor(public nativeSprite: Container, materialOptions?: DisplayObject2dOpts<Texture>)
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
addToWorld(world: PixiGgWorld): void
```

### removeFromWorld (method)

**Signature**

```ts
removeFromWorld(world: PixiGgWorld, dispose?: boolean): void
```

### dispose (method)

**Signature**

```ts
dispose(): void
```

### entity (property)

**Signature**

```ts
entity: IEntity<any, any, GgWorldTypeDocRepo<any, any>> | null
```

### materialOptions (property)

The options this display object was actually built with, when constructed via
`PixiFactory.createPrimitive` - see `IMaterialReadable2dComponent`'s own doc. Left unset for a
sprite built any other way (e.g. `PixiFactory.createAnimatedSprite`), which is why this is
`Partial` rather than a hard implementation of that interface - check with
`isMaterialReadable2d` before relying on it.

**Signature**

```ts
readonly materialOptions: DisplayObject2dOpts<Texture<TextureSource<any>>> | undefined
```

### name (property)

**Signature**

```ts
name: string
```
