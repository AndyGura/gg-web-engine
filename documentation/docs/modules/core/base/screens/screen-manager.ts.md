---
title: core/base/screens/screen-manager.ts
nav_order: 167
parent: Modules
---

## screen-manager overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [ScreenManager (class)](#screenmanager-class)
    - [registerConsoleCommands (static method)](#registerconsolecommands-static-method)
    - [push (method)](#push-method)
    - [replace (method)](#replace-method)
    - [pop (method)](#pop-method)
    - [popTo (method)](#popto-method)
    - [reset (method)](#reset-method)
    - [dispose (method)](#dispose-method)
    - [doDispose (method)](#dodispose-method)
    - [request (method)](#request-method)
    - [transition (method)](#transition-method)
    - [attach (method)](#attach-method)
    - [fallbackFor (method)](#fallbackfor-method)
    - [removeAborted (method)](#removeaborted-method)
    - [setStack (method)](#setstack-method)
    - [cover (method)](#cover-method)
    - [uncover (method)](#uncover-method)
    - [enterScreen (method)](#enterscreen-method)
    - [exitScreen (method)](#exitscreen-method)
    - [safely (method)](#safely-method)
    - [onGgStaticAdded (method)](#onggstaticadded-method)
    - [describeStack (method)](#describestack-method)
    - [container (property)](#container-property)
  - [ScreenManagerOptions (type alias)](#screenmanageroptions-type-alias)
  - [ScreenPushOptions (type alias)](#screenpushoptions-type-alias)

---

# utils

## ScreenManager (class)

Keeps an app's screens as a stack and moves between them: the top screen is the one the player
sees and controls, the ones below are covered (inert, silenced, by default paused) until they
are on top again.

```ts
const screens = new ScreenManager()
screens.push(new MenuScreen())
// from the menu:   this.screens.push(new GameScreen('city'), { clearHistory: true });
// from the game:   this.screens.push(new PauseScreen());
// from the pause:  this.screens.pop();  or  this.screens.reset([new MenuScreen()]);
```

Every operation is one transition, and transitions run one after another in the order they were
requested: first the screens that leave exit, top down (so a game being replaced has given up
its renderer and audio before the next screen allocates its own); then the screen that ends up on
top is entered if it never was, or uncovered. Screens placed below the top by `reset` enter
later, when they are first uncovered. The layers of the screens that left stay on the page until
the new top screen (or the loading view) shows, so there is no blank frame in between.

Each operation returns a promise that resolves when its transition is over: with `true` when its
top screen is shown (or the stack is empty), with `false` when a later request cancelled it. It
rejects if the entered screen's `enter()` threw - that screen is then removed again and the one
below it shown - unless `onEnterError` provided a screen to show instead.

A plain `push` waits for the screens being entered before it. Any other operation cancels the
screens it removes that were not shown yet, judged by the stack as the operations queued before
it leave it: one entering is aborted (its `ctx.signal`), one whose operation still waits is never
entered. So going back during a long load cancels the load, and `push(a); push(b); pop()` never
enters `b`.

Never await an operation from a screen's own `enter()` or `exit()`: it waits for the transition
that is waiting for that very hook, and neither ends. Call it without awaiting instead.

**Signature**

```ts
export declare class ScreenManager {
  constructor(options: ScreenManagerOptions = {})
}
```

### registerConsoleCommands (static method)

**Signature**

```ts
private static registerConsoleCommands(): void
```

### push (method)

Puts `screen` on top of the stack, covering the current top screen.

**Signature**

```ts
public push(screen: Screen, options: ScreenPushOptions = {}): Promise<boolean>
```

### replace (method)

Puts `screen` in place of the top screen, which exits.

**Signature**

```ts
public replace(screen: Screen, options: ScreenPushOptions = {}): Promise<boolean>
```

### pop (method)

Removes the top `count` screens (one by default); the screen below them is on top again.

**Signature**

```ts
public pop(count: number = 1): Promise<boolean>
```

### popTo (method)

Removes every screen above `target`, which is a screen of the stack or a screen class (then the
topmost screen of that class).

**Signature**

```ts
public popTo(target: Screen | ScreenClass): Promise<boolean>
```

### reset (method)

Makes the stack exactly `screens` (bottom first) in one transition. Screens already in the
stack that are listed again stay as they are; the rest exit. Only the last one is entered now.

**Signature**

```ts
public reset(screens: Screen[], options: ScreenPushOptions = {}): Promise<boolean>
```

### dispose (method)

Exits every screen and removes what the manager added to the page.

**Signature**

```ts
public dispose(): Promise<void>
```

### doDispose (method)

**Signature**

```ts
private async doDispose(): Promise<void>
```

### request (method)

Queues one operation. `wanted` computes the stack the operation leads to from the one before
it: applied now to `projected` (the stack once every queued operation has run), it tells which
screens this operation removes; applied again when the operation's turn comes, to the real
stack, it drives the transition.

**Signature**

```ts
private request(
    supersedes: boolean,
    wanted: (stack: readonly Screen[]) => Screen[],
    options: ScreenPushOptions,
  ): Promise<boolean>
```

### transition (method)

**Signature**

```ts
private async transition(wanted: Screen[], options: ScreenPushOptions): Promise<boolean>
```

### attach (method)

**Signature**

```ts
private attach(screen: Screen): void
```

### fallbackFor (method)

**Signature**

```ts
private fallbackFor(error: unknown, screen: Screen): Screen | null
```

### removeAborted (method)

A request that aborted the entering screen and then failed before its transition took that
screen out leaves it on top, never shown: remove it and give the screen below back.

**Signature**

```ts
private async removeAborted(): Promise<void>
```

### setStack (method)

**Signature**

```ts
private setStack(stack: Screen[]): void
```

### cover (method)

**Signature**

```ts
private cover(screen: Screen, pauseWorlds: boolean): void
```

### uncover (method)

**Signature**

```ts
private uncover(screen: Screen): void
```

### enterScreen (method)

**Signature**

```ts
private async enterScreen(
    screen: Screen,
    options: ScreenPushOptions,
    onShown: () => void,
  ): Promise<'entered' | 'aborted' | { error: unknown }>
```

### exitScreen (method)

**Signature**

```ts
private async exitScreen(screen: Screen, entered: boolean = true, keepLayer: boolean = false): Promise<void>
```

### safely (method)

**Signature**

```ts
private safely(run: () => void): void
```

### onGgStaticAdded (method)

**Signature**

```ts
private onGgStaticAdded(): void
```

### describeStack (method)

**Signature**

```ts
private describeStack(indent: string): string
```

### container (property)

The element the screen layers are in.

**Signature**

```ts
readonly container: HTMLElement
```

## ScreenManagerOptions (type alias)

**Signature**

```ts
export type ScreenManagerOptions = {
  /**
   * The element screens are laid out in. By default the manager creates one covering the viewport
   * and adds it to `document.body`. An element of the app's own has to be positioned
   * (`position: relative` or the like), since screen layers are placed absolutely inside it.
   */
  container?: HTMLElement
  /**
   * Creates the view shown while a screen is entering. By default the game-wide default view (see
   * `LoadingScreen.setDefaultView`, `DefaultLoadingView` unless set); `null` for none (screens that
   * show their own progress).
   */
  loadingView?: (() => LoadingView) | null
  /**
   * How long, in milliseconds, a screen may take to enter before the loading view appears - so a
   * screen that is ready at once never flashes it. 150 by default.
   */
  loadingDelay?: number
  /**
   * Once the loading view has appeared, the least time in milliseconds it stays, so a screen ready
   * just after the delay doesn't flash it for a frame. 300 by default.
   */
  loadingMinDuration?: number
  /**
   * Called when a screen's `enter()` throws (not when it is aborted). Return a screen to show in its
   * place - an error screen, the main menu - so a failed `replace` or `clearHistory` push doesn't
   * leave an empty stack. The operation then resolves with `false` instead of rejecting. Called once
   * per operation: if the returned screen fails too, the operation rejects.
   */
  onEnterError?: (error: unknown, screen: Screen) => Screen | null | undefined | void
}
```

## ScreenPushOptions (type alias)

**Signature**

```ts
export type ScreenPushOptions = {
  /** Removes every screen currently in the stack: the pushed screen becomes the only one. */
  clearHistory?: boolean
  /**
   * Whether the worlds of the screen that gets covered are paused. `true` by default. A world whose
   * `localPauseAllowed` is `false` keeps running regardless, and input of covered worlds is
   * switched off regardless.
   */
  pauseBelow?: boolean
  /** Overrides the manager's `loadingView` for this transition. */
  loadingView?: (() => LoadingView) | null
}
```
