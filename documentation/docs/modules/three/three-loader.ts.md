---
title: three/three-loader.ts
nav_order: 191
parent: Modules
---

## three-loader overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [ThreeLoader (class)](#threeloader-class)
    - [loadFromGgGlb (method)](#loadfromggglb-method)
    - [loadFromGlb (method)](#loadfromglb-method)

---

# utils

## ThreeLoader (class)

**Signature**

```ts
export declare class ThreeLoader
```

### loadFromGgGlb (method)

**Signature**

```ts
public async loadFromGgGlb(glbFile: ArrayBuffer, meta: GgMeta): Promise<ThreeDisplayObjectComponent | null>
```

### loadFromGlb (method)

**Signature**

```ts
public async loadFromGlb(
    glbFile: ArrayBuffer,
    options: LoadGlbOptions = {},
  ): Promise<ThreeDisplayObjectComponent | null>
```
