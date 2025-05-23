---
title: core/base/clock/pausable-clock.ts
nav_order: 61
parent: Modules
---

## pausable-clock overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [PausableClock (class)](#pausableclock-class)
    - [start (method)](#start-method)
    - [stop (method)](#stop-method)
    - [pause (method)](#pause-method)
    - [resume (method)](#resume-method)
    - [startListeningTicks (method)](#startlisteningticks-method)
    - [stopListeningTicks (method)](#stoplisteningticks-method)
    - [dispose (method)](#dispose-method)
    - [tickRateLimit (property)](#tickratelimit-property)
    - [paused$ (property)](#paused-property)

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

### dispose (method)

**Signature**

```ts
dispose()
```

### tickRateLimit (property)

Tick rate limiter. If set to 0 - tick rate is unlimited, 15 means "allow at most 15 ticks per second"

**Signature**

```ts
tickRateLimit: number
```

### paused$ (property)

**Signature**

```ts
readonly paused$: any
```
