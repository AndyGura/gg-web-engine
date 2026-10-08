---
title: core/base/inputs/mouse.input.ts
nav_order: 137
parent: Modules
---

## mouse.input overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [MouseInput (class)](#mouseinput-class)
    - [isTouchDevice (static method)](#istouchdevice-static-method)
    - [emulateMove (method)](#emulatemove-method)
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

Whether the device is operated by touch: there is no pointer lock on it, and its view is turned
by dragging a finger.

**Signature**

```ts
static isTouchDevice(): boolean
```

### emulateMove (method)

Emulates a pointer movement: `delta` is emitted through `delta$` as if the mouse had moved by
that many pixels. For anything else that turns a view (an on-screen look pad or stick, a
gamepad). Ignored while the input is not running.

**Signature**

```ts
emulateMove(delta: Point2): void
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

Request pointer lock on the canvas element. No-op if already locked.

**Signature**

```ts
private canvasClickListener(): void
```

## MouseInputOptions (type alias)

Options for a MouseInput.

canvas?: Canvas element. If not provided, mouse events will be listened on the whole window
pointerLock: The flag to enable pointer lock when clicking on canvas
touchSensitivity: What a finger's movement counts for in `delta$`, relative to the mouse: a drag of
`n` pixels is reported as `n * touchSensitivity` pixels of mouse movement. A finger covers far
less distance than a mouse does for the same intended turn, so this is 3 by default - the
same factor the mobile-controls look area applies.

**Signature**

```ts
export type MouseInputOptions = {
  canvas?: HTMLCanvasElement
  pointerLock: boolean
  touchSensitivity: number
}
```
