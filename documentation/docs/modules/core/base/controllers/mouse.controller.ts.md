---
title: core/base/controllers/mouse.controller.ts
nav_order: 41
parent: Modules
---

## mouse.controller overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [MouseController (class)](#mousecontroller-class)
    - [start (method)](#start-method)
    - [canvasClickListener (method)](#canvasclicklistener-method)
    - [stop (method)](#stop-method)
  - [MouseControllerOptions (type alias)](#mousecontrolleroptions-type-alias)
  - [MouseControllerPointLockOptions (type alias)](#mousecontrollerpointlockoptions-type-alias)

---

# utils

## MouseController (class)

**Signature**

```ts
export declare class MouseController {
  constructor(private readonly options: MouseControllerOptions = {})
}
```

### start (method)

**Signature**

```ts
async start()
```

### canvasClickListener (method)

**Signature**

```ts
private canvasClickListener(): void
```

### stop (method)

**Signature**

```ts
async stop(unlockPointer: boolean = true)
```

## MouseControllerOptions (type alias)

**Signature**

```ts
export type MouseControllerOptions = {
  pointerLock?: MouseControllerPointLockOptions
}
```

## MouseControllerPointLockOptions (type alias)

**Signature**

```ts
export type MouseControllerPointLockOptions = { ignoreMovementWhenNotLocked: boolean; canvas: HTMLCanvasElement }
```
