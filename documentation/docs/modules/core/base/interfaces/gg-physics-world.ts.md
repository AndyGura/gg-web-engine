---
title: core/base/interfaces/gg-physics-world.ts
nav_order: 52
parent: Modules
---

## gg-physics-world overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [GgPhysicsWorld (interface)](#ggphysicsworld-interface)

---

# utils

## GgPhysicsWorld (interface)

**Signature**

```ts
export interface GgPhysicsWorld<D, R> {
  readonly factory: any; // type defined in sub-interfaces
  gravity: D;
  timeScale: number;
```
