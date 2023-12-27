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

A class, providing ability to track time, fire ticks, provide time elapsed + tick delta with ability to suspend/resume it.

**Signature**

```ts
export declare class PausableClock {
  constructor(autoStart: boolean = false, protected readonly parentClock: IClock = GgGlobalClock.instance)
}
```

### createChildClock (method)

**Signature**

```ts
createChildClock(autoStart: boolean): PausableClock
```

### start (method)

**Signature**

```ts
start()
```

### stop (method)

**Signature**

```ts
stop()
```

### pause (method)

**Signature**

```ts
pause()
```

### resume (method)

**Signature**

```ts
resume()
```

### startListeningTicks (method)

**Signature**

```ts
protected startListeningTicks()
```

### stopListeningTicks (method)

**Signature**

```ts
protected stopListeningTicks()
```
