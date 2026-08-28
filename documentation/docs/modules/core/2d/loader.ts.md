---
title: core/2d/loader.ts
nav_order: 28
parent: Modules
---

## loader overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [Gg2dLoader (class)](#gg2dloader-class)

---

# utils

## Gg2dLoader (class)

Full loader exposed as `Gg2dWorld.loader`, extending `Gg2dLevelLoader` (so
`registerClass`/`loadLevel`/`loadLevelFromUrl`/`getEntityByName` are all available directly on
`world.loader`) - kept as its own class/type so 2D can grow other loading capabilities (the way
`Gg3dLoader` has GLB loading) without a breaking rename.

**Signature**

```ts
export declare class Gg2dLoader<TypeDoc>
```
