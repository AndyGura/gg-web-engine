---
title: core/base/clock/pausable-clock.ts
nav_order: 60
parent: Modules
---

## pausable-clock overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [PausableClock (class)](#pausableclock-class)
    - [createChildClock (method)](#createchildclock-method)
    - [start (method)](#start-method)
    - [stop (method)](#stop-method)
    - [pause (method)](#pause-method)
    - [resume (method)](#resume-method)
    - [startListeningTicks (method)](#startlisteningticks-method)
    - [stopListeningTicks (method)](#stoplisteningticks-method)

---

# utils

## PausableClock (class)

A class providing the ability to track time, fire ticks, provide time elapsed, and tick delta with the ability to suspend/resume it.

**Signature**

```ts
export declare class PausableClock {
  constructor(autoStart: boolean = false, protected readonly parentClock: IClock = GgGlobalClock.instance)
}
```

### createChildClock (method)

Creates a child clock.

**Signature**

```ts
createChildClock(autoStart: boolean): PausableClock
```

### start (method)

Starts the clock.

**Signature**

```ts
start()
```

### stop (method)

Stops the clock.

**Signature**

```ts
stop()
```

### pause (method)

Pauses the clock.

**Signature**

```ts
pause()
```

### resume (method)

Resumes the clock.

**Signature**

```ts
resume()
```

### startListeningTicks (method)

Starts listening for ticks from the parent clock.

**Signature**

```ts
protected startListeningTicks()
```

### stopListeningTicks (method)

Stops listening for ticks from the parent clock.

**Signature**

```ts
protected stopListeningTicks()
```
