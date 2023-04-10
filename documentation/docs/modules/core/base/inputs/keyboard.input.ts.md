---
title: core/base/inputs/keyboard.input.ts
nav_order: 51
parent: Modules
---

## keyboard.input overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [KeyboardInput (class)](#keyboardinput-class)
    - [startInternal (method)](#startinternal-method)
    - [stopInternal (method)](#stopinternal-method)
    - [bind (method)](#bind-method)
    - [bindMany (method)](#bindmany-method)
    - [emulateKeyDown (method)](#emulatekeydown-method)
    - [emulateKeyUp (method)](#emulatekeyup-method)
    - [emulateKeyPress (method)](#emulatekeypress-method)
    - [handleKeys (method)](#handlekeys-method)

---

# utils

## KeyboardInput (class)

A main keyboard input: it does not have own key bindings, but provides an API to bind keys.
It is responsible for listening key up/down events (when running!) and emit the events to subscribers.
Every World entity has its own dedicated instance of Keyboard input, which is running only when the world is running

**Signature**

```ts
export declare class KeyboardInput {
  constructor()
}
```

### startInternal (method)

**Signature**

```ts
protected async startInternal()
```

### stopInternal (method)

**Signature**

```ts
protected async stopInternal()
```

### bind (method)

Creates an observable that emits a boolean whenever a key with the given code is pressed or released

**Signature**

```ts
bind(code: string): Observable<boolean>
```

### bindMany (method)

Creates an observable that emits a boolean indicating whether any of the keys with the given codes are pressed or released.
Should be used when you have more than one keys, responsible for the same action.

**Signature**

```ts
bindMany(...codes: string[]): Observable<boolean>
```

### emulateKeyDown (method)

Emulates a key down event for the given key code

**Signature**

```ts
emulateKeyDown(code: string): void
```

### emulateKeyUp (method)

Emulates a key up event for the given key code

**Signature**

```ts
emulateKeyUp(code: string): void
```

### emulateKeyPress (method)

Emulates a key press event (down and up) for the given key code

**Signature**

```ts
emulateKeyPress(code: string): void
```

### handleKeys (method)

**Signature**

```ts
private handleKeys(e: KeyboardEvent)
```
