---
title: core/base/screens/loading-view.ts
nav_order: 167
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
  - [DefaultLoadingViewOptions (type alias)](#defaultloadingviewoptions-type-alias)
  - [LoadingView (interface)](#loadingview-interface)

---

# utils

## DefaultLoadingView (class)

The engine's loading view: an opaque dark backdrop with a slowly turning 2x2x2 block, whose
corner cube keeps lifting out and settling back, and "Loading" under it. Once a load reports
progress, a thin bar and a percentage join the label. Plain DOM with inline styles and the Web
Animations API (no stylesheet is added to the page); without that API, or with
`prefers-reduced-motion: reduce`, the cube stands still.

`ScreenManager` shows it while a screen enters, and `LoadingScreen.show()` puts it over the page
for any other load. Restyle it through the `gg-loading` classes (`gg-loading`,
`gg-loading__cube`, `gg-loading__label`, `gg-loading__bar`, `gg-loading__fill`), or replace it
with any other `LoadingView`.

**Signature**

```ts
export declare class DefaultLoadingView {
  constructor(options: DefaultLoadingViewOptions = {})
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

## DefaultLoadingViewOptions (type alias)

**Signature**

```ts
export type DefaultLoadingViewOptions = {
  /** The word under the cube. `'Loading'` by default. */
  label?: string
}
```

## LoadingView (interface)

What a `ScreenManager` (or a `LoadingScreen`) shows while something loads. `element` is put on
top of everything it covers; `setProgress` is called with whatever the load reports.

**Signature**

```ts
export interface LoadingView {
  readonly element: HTMLElement
  setProgress(progress: LoadProgress): void
  dispose(): void
}
```
