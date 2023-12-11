---
title: core/base/inputs/i-input.ts
nav_order: 78
parent: Modules
---

## i-input overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [IInput (class)](#iinput-class)
    - [start (method)](#start-method)
    - [stop (method)](#stop-method)
    - [startInternal (method)](#startinternal-method)
    - [stopInternal (method)](#stopinternal-method)
    - [stop$ (property)](#stop-property)

---

# utils

## IInput (class)

An abstract class that provides basic implementation for Input class.
Input is an entity for handling input from user, such as mouse movements, key presses etc.
Inputs are not bound to World-s and working independently by design.

TStartParams - A type representing an array of input arguments for the start method. Items are recommended to be named.

TStopParams - A type representing an array of input arguments for the stop method. Items are recommended to be named.

**Signature**

```ts
export declare class IInput<TStartParams, TStopParams>
```

### start (method)

A method that starts the input. Do not override it

**Signature**

```ts
start(...args: TStartParams): void
```

### stop (method)

A method that stops the input. Do not override it

**Signature**

```ts
stop(...args: TStopParams): void
```

### startInternal (method)

An abstract method that starts the input.

**Signature**

```ts
protected abstract startInternal(...args: TStartParams): void;
```

### stopInternal (method)

A method that stops the input.

**Signature**

```ts
protected stopInternal(...args: TStopParams): void
```

### stop$ (property)

A protected subject that emits a void value when the process is stopped.
Subclasses, when subscribing to something using rxjs, have to add pipe takeUntil(this.stop$),
so everything will be unsubscribed when stopping input

**Signature**

```ts
readonly stop$: any
```
