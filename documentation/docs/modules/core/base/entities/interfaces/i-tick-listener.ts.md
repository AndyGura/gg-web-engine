---
title: core/base/entities/interfaces/i-tick-listener.ts
nav_order: 44
parent: Modules
---

## i-tick-listener overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [ITickListener (interface)](#iticklistener-interface)
  - [isITickListener](#isiticklistener)

---

# utils

## ITickListener (interface)

**Signature**

```ts
export interface ITickListener {
  // will receive [elapsed time, delta] of each world clock tick
  tick$: Subject<[number, number]>
  // the priority of ticker: the less value, the earlier tick will be run.
  // 500 is a physics tick order
  // 750 is a default objects binding tick order
  // 1000 is a rendering tick order
  // e.g. 499 will run before physics, 1001 will run after rendering
  readonly tickOrder: number
}
```

## isITickListener

**Signature**

```ts
export declare const isITickListener: (entity: GgEntity) => boolean
```
