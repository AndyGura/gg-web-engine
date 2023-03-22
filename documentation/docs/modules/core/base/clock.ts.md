---
title: core/base/clock.ts
nav_order: 34
parent: Modules
---

## clock overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [Clock (class)](#clock-class)
    - [start (method)](#start-method)
    - [stop (method)](#stop-method)
    - [pause (method)](#pause-method)
    - [resume (method)](#resume-method)
    - [startListeningTicks (method)](#startlisteningticks-method)
    - [stopListeningTicks (method)](#stoplisteningticks-method)

---

# utils

## Clock (class)

A class, providing ability to track time, fire ticks, provide time elapsed + tick delta with ability to suspend/resume it.

**Signature**

```ts
export declare class Clock {
  constructor(private readonly tickSource: Observable<any>, autoStart: boolean = false)
}
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
private startListeningTicks()
```

### stopListeningTicks (method)

**Signature**

```ts
private stopListeningTicks()
```
