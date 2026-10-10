---
title: pixi/utils/clone-container.ts
nav_order: 205
parent: Modules
---

## clone-container overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [cloneContainer](#clonecontainer)
  - [copyContainerState](#copycontainerstate)

---

# utils

## cloneContainer

Deep copy of a native display object and everything nested in it. pixi.js has no generic
`Container.clone()`, so this covers the kinds of object this package's factory and components
build: `Graphics`, `Sprite`, `AnimatedSprite`, `Text` and plain `Container`. Textures are shared
with the source, everything else is independent of it - destroying the copy leaves the source
intact and vice versa.

**Signature**

```ts
export declare function cloneContainer<T extends Container>(source: T): T
```

## copyContainerState

Copies everything a display object component exposes (transform, visibility, z-index, tint,
opacity) from `source` to `target`, and gives `target` its own deep copy of each of `source`'s
children.

**Signature**

```ts
export declare function copyContainerState(source: Container, target: Container): void
```
