---
title: core/base/clock/i-clock.ts
nav_order: 59
parent: Modules
---

## i-clock overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [IClock (class)](#iclock-class)
    - [addChild (method)](#addchild-method)
    - [removeChild (method)](#removechild-method)
    - [dispose (method)](#dispose-method)
    - [\_tick$ (property)](#_tick-property)
    - [\_children (property)](#_children-property)

---

# utils

## IClock (class)

**Signature**

```ts
export declare class IClock {
  protected constructor(public readonly parent: IClock | null)
}
```

### addChild (method)

**Signature**

```ts
public addChild(clock: IClock)
```

### removeChild (method)

**Signature**

```ts
public removeChild(clock: IClock)
```

### dispose (method)

**Signature**

```ts
public dispose()
```

### \_tick$ (property)

**Signature**

```ts
readonly _tick$: any
```

### \_children (property)

**Signature**

```ts
_children: IClock[]
```
