---
title: core/base/screens/loading-screen.ts
nav_order: 166
parent: Modules
---

## loading-screen overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [LoadingScreen (class)](#loadingscreen-class)
    - [setDefaultView (static method)](#setdefaultview-static-method)
    - [createDefaultView (static method)](#createdefaultview-static-method)
    - [show (static method)](#show-static-method)
    - [setProgress (method)](#setprogress-method)
    - [hide (method)](#hide-method)
  - [LoadingScreenOptions (type alias)](#loadingscreenoptions-type-alias)

---

# utils

## LoadingScreen (class)

A loading view shown over the page (or one element) until `hide()`: the app decides what it
covers. Typically a game's startup or a level (re)load:

```ts
const loading = LoadingScreen.show() // or LoadingScreen.show({ view: myOwnLoadingView })
await world.init()
await world.loader.loadLevel(level, 'Level', { onProgress: (p) => loading.setProgress(p) })
world.start()
loading.hide()
```

Without a `view` it shows the default view: a `DefaultLoadingView`, unless the game sets its own
once with `LoadingScreen.setDefaultView(() => new MyLoadingView())`. Any object implementing
`LoadingView` works.

**Signature**

```ts
export declare class LoadingScreen {
  private constructor(public readonly view: LoadingView, container: HTMLElement | undefined, fadeOutDuration: number)
}
```

### setDefaultView (static method)

Sets how the default loading view is made, for `LoadingScreen.show()` without a `view` and for a
`ScreenManager` without a `loadingView`. A factory, not a view: each screen disposes its view when
it hides. `null` goes back to `DefaultLoadingView`.

**Signature**

```ts
public static setDefaultView(factory: (() => LoadingView) | null): void
```

### createDefaultView (static method)

A new instance of the default loading view (see `setDefaultView`).

**Signature**

```ts
public static createDefaultView(): LoadingView
```

### show (static method)

Shows a loading view now and returns the handle that hides it.

**Signature**

```ts
public static show(options: LoadingScreenOptions = {}): LoadingScreen
```

### setProgress (method)

**Signature**

```ts
public setProgress(progress: LoadProgress): void
```

### hide (method)

Fades the screen out, then removes it and disposes the view. Later calls do nothing.

**Signature**

```ts
public hide(): void
```

## LoadingScreenOptions (type alias)

**Signature**

```ts
export type LoadingScreenOptions = {
  /** The view to show. By default one made by the factory given to `LoadingScreen.setDefaultView`. */
  view?: LoadingView
  /**
   * Where to show it. By default the screen covers the whole viewport, above the page (fixed, added
   * to `document.body`). An element of the app's own has to be positioned (`position: relative` or
   * the like), since the view is placed absolutely inside it.
   */
  container?: HTMLElement
  /** How long, in milliseconds, `hide()` fades the screen out before removing it. 250 by default. */
  fadeOutDuration?: number
}
```
