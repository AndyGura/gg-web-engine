---
title: core/base/controllers/keyboard.controller.ts
nav_order: 37
parent: Modules
---

## keyboard.controller overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [KeyboardController (class)](#keyboardcontroller-class)
    - [bind (method)](#bind-method)
    - [bindMany (method)](#bindmany-method)
    - [emulateKeyDown (method)](#emulatekeydown-method)
    - [emulateKeyUp (method)](#emulatekeyup-method)
    - [emulateKeyPress (method)](#emulatekeypress-method)
    - [start (method)](#start-method)
    - [handleKeys (method)](#handlekeys-method)
    - [stop (method)](#stop-method)

---

# utils

## KeyboardController (class)

**Signature**

```ts
export declare class KeyboardController {
  constructor()
}
```

### bind (method)

**Signature**

```ts
bind(code: string): Observable<boolean>
```

### bindMany (method)

**Signature**

```ts
bindMany(...codes: string[]): Observable<boolean>
```

### emulateKeyDown (method)

**Signature**

```ts
emulateKeyDown(code: string): void
```

### emulateKeyUp (method)

**Signature**

```ts
emulateKeyUp(code: string): void
```

### emulateKeyPress (method)

**Signature**

```ts
emulateKeyPress(code: string): void
```

### start (method)

**Signature**

```ts
async start()
```

### handleKeys (method)

**Signature**

```ts
private handleKeys(e: KeyboardEvent)
```

### stop (method)

**Signature**

```ts
async stop()
```
