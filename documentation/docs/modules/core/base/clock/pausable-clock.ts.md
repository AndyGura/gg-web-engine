---
title: core/base/clock/pausable-clock.ts
nav_order: 110
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
    - [step (method)](#step-method)
    - [resume (method)](#resume-method)
    - [startListeningTicks (method)](#startlisteningticks-method)
    - [stopListeningTicks (method)](#stoplisteningticks-method)
    - [dispose (method)](#dispose-method)
    - [tickRateLimit (property)](#tickratelimit-property)
    - [maxTickDelta (property)](#maxtickdelta-property)
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

### step (method)

Fires exactly one tick with the given delta while the clock is paused, without resuming it -
useful for frame-by-frame debugging. `elapsedTime` (and everything derived from it - child
clocks, animations, anything reading `this.elapsedTime`) advances by exactly `delta`, same as
it would over `delta` worth of normal ticking, and stays at that new instant once `step`
returns (the clock is still paused, it just moved its frozen instant forward). A manual step
is never throttled by `tickRateLimit`, and resuming afterwards continues seamlessly from the
stepped-to instant rather than losing or double-counting the stepped time.

**Signature**

```ts
step(delta: number)
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

### maxTickDelta (property)

Upper bound, in milliseconds, on the scaled delta of any single tick reaching `tick$` -
protects against a huge, unrepresentative delta after a long stall (a backgrounded/minimized
tab being one common cause - see `GgWorld.pauseWhenHidden` for pausing the clock outright
instead, which avoids producing a tick at all) blowing up physics/animation that assumes a
roughly real-time delta. When the parent clock's delta, scaled by `timeScale`, exceeds this
value, the tick reaching `tick$` (and the amount `elapsedTime` advances by) is clamped to
exactly `maxTickDelta`; the remainder is simply dropped, not carried over to a later tick. This
means `elapsedTime` and real wall-clock time deliberately diverge by the sum of every dropped
remainder once clamping has ever triggered - `elapsedTime` under-counts wall time by design, so
that anything driven by clock ticks (physics integration, animation) never has to reason about
an implausibly large single-frame delta. Defaults to 250 (ms); set to 0 to disable clamping
entirely. `step()` is never subject to this clamp - it always reports exactly the `delta` it
was called with, since it exists for deterministic frame-by-frame control, not real-time
playback.

**Signature**

```ts
maxTickDelta: number
```

### paused$ (property)

**Signature**

```ts
readonly paused$: any
```
