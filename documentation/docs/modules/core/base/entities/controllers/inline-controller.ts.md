---
title: core/base/entities/controllers/inline-controller.ts
nav_order: 71
parent: Modules
---

## inline-controller overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [createInlineTickController](#createinlinetickcontroller)

---

# utils

## createInlineTickController

**Signature**

```ts
export declare function createInlineTickController(
  world: GgWorld<any, any>,
  tickOrder: number = TickOrder.CONTROLLERS
): Observable<[number, number]>
```
