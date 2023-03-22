---
title: core/3d/gg-3d-world.ts
nav_order: 28
parent: Modules
---

## gg-3d-world overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [Gg3dWorld (class)](#gg3dworld-class)
    - [loader (property)](#loader-property)

---

# utils

## Gg3dWorld (class)

**Signature**

```ts
export declare class Gg3dWorld<V, P> {
  constructor(
    public readonly visualScene: V,
    public readonly physicsWorld: P,
    protected readonly consoleEnabled: boolean = false
  )
}
```

### loader (property)

**Signature**

```ts
readonly loader: Gg3dLoader
```
