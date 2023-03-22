---
title: core/2d/gg-2d-world.ts
nav_order: 14
parent: Modules
---

## gg-2d-world overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [Gg2dWorld (class)](#gg2dworld-class)

---

# utils

## Gg2dWorld (class)

**Signature**

```ts
export declare class Gg2dWorld<V, P> {
  constructor(
    public readonly visualScene: V,
    public readonly physicsWorld: P,
    protected readonly consoleEnabled: boolean = false
  )
}
```
