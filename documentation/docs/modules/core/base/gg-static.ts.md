---
title: core/base/gg-static.ts
nav_order: 45
parent: Modules
---

## gg-static overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [GgStatic (class)](#ggstatic-class)
    - [console (method)](#console-method)
    - [worlds (property)](#worlds-property)
    - [selectedWorld (property)](#selectedworld-property)

---

# utils

## GgStatic (class)

**Signature**

```ts
export declare class GgStatic {
  private constructor()
}
```

### console (method)

**Signature**

```ts
async console(input: string): Promise<string>
```

### worlds (property)

**Signature**

```ts
readonly worlds: GgWorld<any, any, GgVisualScene<any, any>, GgPhysicsWorld<any, any>>[]
```

### selectedWorld (property)

**Signature**

```ts
selectedWorld: GgWorld<any, any, GgVisualScene<any, any>, GgPhysicsWorld<any, any>> | null
```
