---
title: core/base/gg-viewport.ts
nav_order: 51
parent: Modules
---

## gg-viewport overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [GgViewport (class)](#ggviewport-class)
    - [activate (method)](#activate-method)
    - [deactivate (method)](#deactivate-method)
    - [getCurrentViewportSize (method)](#getcurrentviewportsize-method)
    - [subscribeOnViewportSize (method)](#subscribeonviewportsize-method)
    - [isMouseEnabled (method)](#ismouseenabled-method)
    - [isTouchDevice (method)](#istouchdevice-method)
    - [subscribeOnMouseMove (method)](#subscribeonmousemove-method)
    - [subscribeOnIsMouseDown (method)](#subscribeonismousedown-method)
    - [subscribeOnMouseClick (method)](#subscribeonmouseclick-method)
    - [destroy$ (property)](#destroy-property)

---

# utils

## GgViewport (class)

**Signature**

```ts
export declare class GgViewport {
  private constructor()
}
```

### activate (method)

**Signature**

```ts
public activate()
```

### deactivate (method)

**Signature**

```ts
public deactivate(): void
```

### getCurrentViewportSize (method)

**Signature**

```ts
getCurrentViewportSize(): Point2
```

### subscribeOnViewportSize (method)

**Signature**

```ts
subscribeOnViewportSize(): Observable<Point2>
```

### isMouseEnabled (method)

**Signature**

```ts
isMouseEnabled(): boolean
```

### isTouchDevice (method)

**Signature**

```ts
isTouchDevice(): boolean
```

### subscribeOnMouseMove (method)

**Signature**

```ts
subscribeOnMouseMove(): Observable<Point2>
```

### subscribeOnIsMouseDown (method)

**Signature**

```ts
subscribeOnIsMouseDown(): Observable<boolean>
```

### subscribeOnMouseClick (method)

**Signature**

```ts
subscribeOnMouseClick(): Observable<Point2>
```

### destroy$ (property)

**Signature**

```ts
destroy$: any
```
