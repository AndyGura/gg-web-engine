---
title: core/base/clock/global-clock.ts
nav_order: 58
parent: Modules
---

## global-clock overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [GgGlobalClock (class)](#ggglobalclock-class)
    - [dispose (method)](#dispose-method)

---

# utils

## GgGlobalClock (class)

A singleton class, providing ability to track time, fire ticks, provide time elapsed + tick delta.
Starts as soon as accessed and counts time from 01/01/1970

**Signature**

```ts
export declare class GgGlobalClock {
  private constructor()
}
```

### dispose (method)

**Signature**

```ts
dispose()
```
