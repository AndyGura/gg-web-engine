---
title: ammo/components/ammo-body.component.ts
nav_order: 5
parent: Modules
---

## ammo-body.component overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [AmmoBodyComponent (class)](#ammobodycomponent-class)
    - [clone (method)](#clone-method)
    - [addToWorld (method)](#addtoworld-method)
    - [removeFromWorld (method)](#removefromworld-method)
    - [dispose (method)](#dispose-method)
    - [name (property)](#name-property)
    - [entity (property)](#entity-property)

---

# utils

## AmmoBodyComponent (class)

**Signature**

```ts
export declare class AmmoBodyComponent<T> {
  protected constructor(protected readonly world: AmmoWorldComponent, protected _nativeBody: T)
}
```

### clone (method)

**Signature**

```ts
abstract clone(): AmmoBodyComponent<T>;
```

### addToWorld (method)

**Signature**

```ts
abstract addToWorld(world: Gg3dWorld<IVisualScene3dComponent, AmmoWorldComponent>): void;
```

### removeFromWorld (method)

**Signature**

```ts
abstract removeFromWorld(world: Gg3dWorld<IVisualScene3dComponent, AmmoWorldComponent>): void;
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

### entity (property)

**Signature**

```ts
entity: any
```
