---
title: core/base/inputs/mouse.input.ts
nav_order: 80
parent: Modules
---

## mouse.input overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [MouseInput (class)](#mouseinput-class)
    - [isTouchDevice (static method)](#istouchdevice-static-method)
    - [startInternal (method)](#startinternal-method)
    - [stopInternal (method)](#stopinternal-method)
    - [canvasClickListener (method)](#canvasclicklistener-method)
  - [MouseInputOptions (type alias)](#mouseinputoptions-type-alias)

---

# utils

## MouseInput (class)

A class representing mouse input.

**Signature**

```ts
export declare class MouseInput {
  constructor(options: Partial<MouseInputOptions> = {})
}
```

### isTouchDevice (static method)

**Signature**

```ts
static isTouchDevice(): boolean
```

### startInternal (method)

**Signature**

```ts
protected startInternal()
```

### stopInternal (method)

Stop listening for mouse movement events.

**Signature**

```ts
protected stopInternal(unlockPointer: boolean = true)
```

### canvasClickListener (method)

Request pointer lock on the canvas element.

**Signature**

```ts
private canvasClickListener(): void
```

## MouseInputOptions (type alias)

Options for a MouseInput.

canvas?: Canvas element. If not provided, mouse events will be listened on the whole window
pointerLock: The flag to enable pointer lock when clicking on canvas

**Signature**

```ts
export type MouseInputOptions = {
  canvas?: HTMLCanvasElement
  pointerLock: boolean
}
```
