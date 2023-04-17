---
title: core/base/inputs/mouse.input.ts
nav_order: 51
parent: Modules
---

## mouse.input overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [MouseInput (class)](#mouseinput-class)
    - [startInternal (method)](#startinternal-method)
    - [stopInternal (method)](#stopinternal-method)
    - [canvasClickListener (method)](#canvasclicklistener-method)
  - [MouseInputOptions (type alias)](#mouseinputoptions-type-alias)
  - [MouseInputPointLockOptions (type alias)](#mouseinputpointlockoptions-type-alias)

---

# utils

## MouseInput (class)

A class representing mouse input.

**Signature**

```ts
export declare class MouseInput {
  constructor(private readonly options: MouseInputOptions = {})
}
```

### startInternal (method)

**Signature**

```ts
protected async startInternal()
```

### stopInternal (method)

Stop listening for mouse movement events.

**Signature**

```ts
protected async stopInternal(unlockPointer: boolean = true)
```

### canvasClickListener (method)

Request pointer lock on the canvas element.

**Signature**

```ts
private canvasClickListener(): void
```

## MouseInputOptions (type alias)

Options for a MouseInput.

pointerLock: The options for pointer lock. Do not provide it to disable pointer lock functionality

**Signature**

```ts
export type MouseInputOptions = {
  pointerLock?: MouseInputPointLockOptions
}
```

## MouseInputPointLockOptions (type alias)

Options for pointer lock in a MouseInput.

ignoreMovementWhenNotLocked: Whether to ignore mouse movement when pointer lock is not active.

canvas: The canvas element to request pointer lock on.

**Signature**

```ts
export type MouseInputPointLockOptions = { ignoreMovementWhenNotLocked: boolean; canvas: HTMLCanvasElement }
```
