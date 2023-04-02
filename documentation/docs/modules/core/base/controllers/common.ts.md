---
title: core/base/controllers/common.ts
nav_order: 38
parent: Modules
---

## common overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [DirectionKeymap (type alias)](#directionkeymap-type-alias)
  - [DirectionOutput (type alias)](#directionoutput-type-alias)
  - [bindDirectionKeys](#binddirectionkeys)

---

# utils

## DirectionKeymap (type alias)

**Signature**

```ts
export type DirectionKeymap = 'arrows' | 'wasd' | 'wasd+arrows'
```

## DirectionOutput (type alias)

**Signature**

```ts
export type DirectionOutput = { upDown?: boolean; leftRight?: boolean }
```

## bindDirectionKeys

**Signature**

```ts
export declare const bindDirectionKeys: (keyboard: KeyboardController, keymap: DirectionKeymap) => any
```
