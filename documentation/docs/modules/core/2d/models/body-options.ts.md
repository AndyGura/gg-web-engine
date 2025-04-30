---
title: core/2d/models/body-options.ts
nav_order: 26
parent: Modules
---

## body-options overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [Body2DOptions (interface)](#body2doptions-interface)
  - [DebugBody2DSettings (class)](#debugbody2dsettings-class)

---

# utils

## Body2DOptions (interface)

**Signature**

```ts
export interface Body2DOptions extends BodyOptions {}
```

## DebugBody2DSettings (class)

**Signature**

```ts
export declare class DebugBody2DSettings {
  constructor(
    type: DebugBodyType,
    shape: Shape2DDescriptor,
    ignoreTransform: boolean = false,
    color: number | undefined = undefined
  )
}
```
