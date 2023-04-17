---
title: core/base/inputs/input.ts
nav_order: 49
parent: Modules
---

## input overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [Input (class)](#input-class)
    - [start (method)](#start-method)
    - [stop (method)](#stop-method)
    - [startInternal (method)](#startinternal-method)
    - [stopInternal (method)](#stopinternal-method)
    - [stop$ (property)](#stop-property)

---

# utils

## Input (class)

An abstract class that provides basic implementation for Input class.
Input is an entity for handling input from user, such as mouse movements, key presses etc.
Inputs are not bound to World-s and working independently by design.

TStartParams - A type representing an array of input arguments for the start method. Items are recommended to be named.

TStopParams - A type representing an array of input arguments for the stop method. Items are recommended to be named.

**Signature**

```ts
export declare class Input<TStartParams, TStopParams>
```

### start (method)

An asynchronous method that starts the input. Do not override it

**Signature**

```ts
async start(...args: TStartParams): Promise<void>
```

### stop (method)

An asynchronous method that stops the input. Do not override it

**Signature**

```ts
async stop(...args: TStopParams): Promise<void>
```

### startInternal (method)

An abstract asynchronous method that starts the input.

**Signature**

```ts
protected abstract startInternal(...args: TStartParams): Promise<void>;
```

### stopInternal (method)

An asynchronous method that stops the input.

**Signature**

```ts
protected async stopInternal(...args: TStopParams): Promise<void>
```

### stop$ (property)

A protected subject that emits a void value when the process is stopped.
Subclasses, when subscribing to something using rxjs, have to add pipe takeUntil(this.stop$),
so everything will be unsubscribed when stopping input

**Signature**

```ts
readonly stop$: any
```
