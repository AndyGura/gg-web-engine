---
title: core/base/screens/loading-view.ts
nav_order: 165
parent: Modules
---

## loading-view overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [DefaultLoadingView (class)](#defaultloadingview-class)
    - [setProgress (method)](#setprogress-method)
    - [dispose (method)](#dispose-method)
    - [element (property)](#element-property)
  - [LoadingView (interface)](#loadingview-interface)

---

# utils

## DefaultLoadingView (class)

The loading view a `ScreenManager` uses unless given another: an opaque backdrop with a progress
bar and a percentage, plain DOM with inline styles. Restyle it through the `gg-loading` classes
(`gg-loading`, `gg-loading__bar`, `gg-loading__fill`, `gg-loading__label`), or replace it with
the manager's `loadingView` option.

**Signature**

```ts
export declare class DefaultLoadingView {
  constructor()
}
```

### setProgress (method)

**Signature**

```ts
public setProgress(progress: LoadProgress): void
```

### dispose (method)

**Signature**

```ts
public dispose(): void
```

### element (property)

**Signature**

```ts
readonly element: HTMLElement
```

## LoadingView (interface)

What a `ScreenManager` shows while a screen's `enter()` is pending. `element` is put on top of
every screen layer; `setProgress` is called with whatever the entering screen reports.

**Signature**

```ts
export interface LoadingView {
  readonly element: HTMLElement
  setProgress(progress: LoadProgress): void
  dispose(): void
}
```
