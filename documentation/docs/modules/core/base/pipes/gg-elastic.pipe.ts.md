---
title: core/base/pipes/gg-elastic.pipe.ts
nav_order: 97
parent: Modules
---

## gg-elastic.pipe overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [ggElastic](#ggelastic)

---

# utils

## ggElastic

**Signature**

```ts
export declare function ggElastic<T>(
  tick$: Observable<[number, number]>, // [elapsed, delta]
  elasticity: number, // Elasticity parameter
  mix: (a: T, b: T, factor: number) => T, // Mixing function
  equals: (a: T, b: T) => boolean // Equality check function
): OperatorFunction<T, T>
```
