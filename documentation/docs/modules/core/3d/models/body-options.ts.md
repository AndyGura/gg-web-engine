---
title: core/3d/models/body-options.ts
nav_order: 56
parent: Modules
---

## body-options overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [Body3DOptions (interface)](#body3doptions-interface)
  - [DebugBody3DSettings (class)](#debugbody3dsettings-class)

---

# utils

## Body3DOptions (interface)

**Signature**

```ts
export interface Body3DOptions extends BodyOptions {}
```

## DebugBody3DSettings (class)

**Signature**

```ts
export declare class DebugBody3DSettings {
  constructor(
    type: DebugBodyType,
    shape: Shape3DDescriptor,
    ignoreTransform: boolean = false,
    color: number | undefined = undefined
  )
}
```
