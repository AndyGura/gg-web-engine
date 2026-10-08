---
title: core/base/screens/screen.ts
nav_order: 168
parent: Modules
---

## screen overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [Screen (class)](#screen-class)
    - [enter (method)](#enter-method)
    - [exit (method)](#exit-method)
    - [onCovered (method)](#oncovered-method)
    - [onUncovered (method)](#onuncovered-method)
    - [addWorld (method)](#addworld-method)
    - [addTeardown (method)](#addteardown-method)
    - [coverWorld (method)](#coverworld-method)
    - [pauseCoveredWorld (method)](#pausecoveredworld-method)
    - [releasePause (method)](#releasepause-method)
    - [uncoverWorld (method)](#uncoverworld-method)
  - [ScreenEnterContext (type alias)](#screenentercontext-type-alias)
  - [ScreenInternals (type alias)](#screeninternals-type-alias)
  - [ScreenState (type alias)](#screenstate-type-alias)
  - [ScreenTeardown (type alias)](#screenteardown-type-alias)

---

# utils

## Screen (class)

One screen of an app - a main menu, a game, a pause overlay, a settings page. A screen is a DOM
layer (`layer`) over which it has full control, plus a lifecycle driven by a `ScreenManager`:
`enter()` once when it first comes on top of the stack, `onCovered()`/`onUncovered()` whenever
another screen is put on top of it or taken off again, `exit()` when it leaves the stack.

A screen instance is used once: create a new one for every push, and pass what it needs to its
constructor. A screen needs no world. One that has a world (usually only the game) creates it in
`enter()` with the adapters of its choice, renders it into a canvas it adds to `layer`, and
registers it with `addWorld`, which is what lets the manager silence and pause it while it is
covered and dispose it on exit.

```ts
class GameScreen extends Screen {
  constructor(private readonly level: string) {
    super()
  }

  async enter(ctx: ScreenEnterContext) {
    const world = this.addWorld(await createWorld(this.layer))
    await world.loader.loadLevelFromUrl(`levels/${this.level}.json`, 'level', {
      onProgress: ctx.reportProgress,
      signal: ctx.signal,
    })
    this.addTeardown(this.keyboard.bind('Escape').subscribe((down) => down && this.screens.push(new PauseScreen())))
    world.start()
  }
}
```

**Signature**

```ts
export declare class Screen
```

### enter (method)

Builds the screen: create DOM in `layer`, create and load worlds, subscribe to things. Called
once, when the screen first comes on top of the stack. While the returned promise is pending
the layer is kept hidden and the manager shows its loading view, fed by `ctx.reportProgress`.

Register everything that has to go away with the screen through `addWorld`/`addTeardown` as
soon as it exists, not at the end: if `enter()` throws or is aborted halfway, that is all that
gets cleaned up (`exit()` is not called for a screen that never finished entering).

Don't `await` a `ScreenManager` operation in here (a boot screen awaiting `push(menu)`):
operations run one after another, and that one only starts once this transition, which is
waiting for `enter()`, is over - it never resolves. Call it without awaiting; it runs right
after this screen has entered.

**Signature**

```ts
public abstract enter(ctx: ScreenEnterContext): void | Promise<void>;
```

### exit (method)

Called when the screen leaves the stack after having entered, before its teardowns run and its
worlds are disposed. May return a promise (a fade-out); the transition waits for it - so, as in
`enter()`, never await a `ScreenManager` operation in here.

**Signature**

```ts
public exit(): void | Promise<void>
```

### onCovered (method)

Called when another screen is put on top of this one. By now the manager has already made the
layer inert, switched off the input of this screen's worlds and (unless told otherwise) paused
them. Override for anything else the screen runs on its own.

**Signature**

```ts
public onCovered(): void
```

### onUncovered (method)

Called when this screen is on top again, after its worlds got their input and clock back.

**Signature**

```ts
public onUncovered(): void
```

### addWorld (method)

Hands a world to the screen: the manager switches its input off and pauses it while the screen
is covered, and it is disposed when the screen exits. Returns the world, for chaining.

Call it right after creating the world, before loading into it. Whether a covered world is
paused is decided by the push that covers it (`pauseBelow`) and by the world itself: a world
with `localPauseAllowed === false` (a joined network session) keeps running, and a change of
that flag while the screen is covered pauses or resumes it. A world paused for a hidden tab
(`pauseWhenHidden`) when it gets covered stays paused until the screen is uncovered. Its input
is switched off either way.

**Signature**

```ts
protected addWorld<W extends GgWorld<any, any>>(world: W): W
```

### addTeardown (method)

Registers something to clean up when the screen exits: a function to call, an rxjs
`Subscription` to unsubscribe, or anything with `dispose()`. They run in reverse order of
registration, before the screen's worlds are disposed.

**Signature**

```ts
protected addTeardown(teardown: ScreenTeardown): void
```

### coverWorld (method)

**Signature**

```ts
private coverWorld(owned: OwnedWorld): void
```

### pauseCoveredWorld (method)

**Signature**

```ts
private pauseCoveredWorld(owned: OwnedWorld): void
```

### releasePause (method)

**Signature**

```ts
private releasePause(owned: OwnedWorld): void
```

### uncoverWorld (method)

**Signature**

```ts
private uncoverWorld(owned: OwnedWorld): void
```

## ScreenEnterContext (type alias)

What `Screen.enter` is given.

**Signature**

```ts
export type ScreenEnterContext = {
  /**
   * Aborted when the screen is removed while it is still entering (the player went back during
   * loading, another screen replaced it). Pass it to every load so `enter()` ends promptly.
   */
  signal: AbortSignal
  /**
   * Feeds the loading view shown while `enter()` is pending. Takes a loader's `LoadProgress` as is
   * (`onProgress: ctx.reportProgress`) or a plain 0..1 fraction.
   */
  reportProgress: (progress: LoadProgress | number) => void
}
```

## ScreenInternals (type alias)

What `ScreenManager` drives a screen through. Not for app code.

**Signature**

```ts
export type ScreenInternals = {
  attach(manager: ScreenManager, layer: HTMLElement): void
  setState(state: ScreenState): void
  setCovered(covered: boolean, pauseWorlds: boolean): void
  /** Runs the teardowns and disposes the worlds; with `keepLayer` the caller removes the layer. */
  teardown(keepLayer?: boolean): void
}
```

## ScreenState (type alias)

Where a screen is in its life:

- `pending`: in the stack, not entered yet (pushed just now, or placed under other screens by
  `ScreenManager.reset` and waiting to be uncovered for the first time);
- `entering`: its `enter()` is running;
- `active`: entered and on top of the stack;
- `covered`: entered, with another screen on top of it;
- `exited`: removed from the stack. A screen is never used again after that.

**Signature**

```ts
export type ScreenState = 'pending' | 'entering' | 'active' | 'covered' | 'exited'
```

## ScreenTeardown (type alias)

Something a screen cleans up when it exits - see `Screen.addTeardown`.

**Signature**

```ts
export type ScreenTeardown = (() => void) | { unsubscribe(): void } | { dispose(): void }
```
