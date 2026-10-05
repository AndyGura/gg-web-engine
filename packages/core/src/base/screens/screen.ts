import { GgWorld } from '../gg-world';
import { KeyboardInput } from '../inputs/keyboard.input';
import { LoadProgress } from '../assets/load-progress';
import type { ScreenManager } from './screen-manager';

/**
 * Where a screen is in its life:
 * - `pending`: in the stack, not entered yet (pushed just now, or placed under other screens by
 *   `ScreenManager.reset` and waiting to be uncovered for the first time);
 * - `entering`: its `enter()` is running;
 * - `active`: entered and on top of the stack;
 * - `covered`: entered, with another screen on top of it;
 * - `exited`: removed from the stack. A screen is never used again after that.
 */
export type ScreenState = 'pending' | 'entering' | 'active' | 'covered' | 'exited';

/** What `Screen.enter` is given. */
export type ScreenEnterContext = {
  /**
   * Aborted when the screen is removed while it is still entering (the player went back during
   * loading, another screen replaced it). Pass it to every load so `enter()` ends promptly.
   */
  signal: AbortSignal;
  /**
   * Feeds the loading view shown while `enter()` is pending. Takes a loader's `LoadProgress` as is
   * (`onProgress: ctx.reportProgress`) or a plain 0..1 fraction.
   */
  reportProgress: (progress: LoadProgress | number) => void;
};

/** Something a screen cleans up when it exits - see `Screen.addTeardown`. */
export type ScreenTeardown = (() => void) | { unsubscribe(): void } | { dispose(): void };

type OwnedWorld = { world: GgWorld<any, any>; pausedHere: boolean; inputDisabledHere: boolean };

/** What `ScreenManager` drives a screen through. Not for app code. */
export type ScreenInternals = {
  attach(manager: ScreenManager, layer: HTMLElement): void;
  setState(state: ScreenState): void;
  setCovered(covered: boolean, pauseWorlds: boolean): void;
  teardown(): void;
};

/**
 * One screen of an app - a main menu, a game, a pause overlay, a settings page. A screen is a DOM
 * layer (`layer`) over which it has full control, plus a lifecycle driven by a `ScreenManager`:
 * `enter()` once when it first comes on top of the stack, `onCovered()`/`onUncovered()` whenever
 * another screen is put on top of it or taken off again, `exit()` when it leaves the stack.
 *
 * A screen instance is used once: create a new one for every push, and pass what it needs to its
 * constructor. A screen needs no world. One that has a world (usually only the game) creates it in
 * `enter()` with the adapters of its choice, renders it into a canvas it adds to `layer`, and
 * registers it with `addWorld`, which is what lets the manager silence and pause it while it is
 * covered and dispose it on exit.
 *
 * ```ts
 * class GameScreen extends Screen {
 *   constructor(private readonly level: string) {
 *     super();
 *   }
 *
 *   async enter(ctx: ScreenEnterContext) {
 *     const world = this.addWorld(await createWorld(this.layer));
 *     await world.loader.loadLevelFromUrl(`levels/${this.level}.json`, 'level', {
 *       onProgress: ctx.reportProgress,
 *       signal: ctx.signal,
 *     });
 *     this.addTeardown(
 *       this.keyboard.bind('Escape').subscribe(down => down && this.screens.push(new PauseScreen())),
 *     );
 *     world.start();
 *   }
 * }
 * ```
 */
export abstract class Screen {
  private _layer: HTMLElement | null = null;
  private _manager: ScreenManager | null = null;
  private _state: ScreenState = 'pending';
  private _keyboard: KeyboardInput | null = null;
  private readonly worlds: OwnedWorld[] = [];
  private readonly teardowns: ScreenTeardown[] = [];
  private covered = false;
  private pauseWhileCovered = true;

  /**
   * This screen's DOM layer: fills the manager's container, stacked above the layers of the screens
   * below it. Put the screen's UI and canvases into it. Exists from the moment the screen is
   * pushed until it has exited.
   * @throws before the screen is pushed
   */
  public get layer(): HTMLElement {
    if (!this._layer) {
      throw new Error('The screen has no layer yet: it is created when the screen is pushed to a ScreenManager');
    }
    return this._layer;
  }

  /**
   * The manager this screen is in - for pushing and popping from the screen's own handlers.
   * @throws before the screen is pushed
   */
  public get screens(): ScreenManager {
    if (!this._manager) {
      throw new Error('The screen is not in a ScreenManager yet');
    }
    return this._manager;
  }

  public get state(): ScreenState {
    return this._state;
  }

  /**
   * A keyboard input of this screen's own, running only while the screen is on top of the stack:
   * keys bound here do nothing while the screen is loading, covered or gone. For the screen's own
   * shortcuts (Escape to open a pause menu, or to close it) - a world's gameplay keys stay on that
   * world's `keyboardInput`. Created on first use, stopped for good on exit.
   */
  public get keyboard(): KeyboardInput {
    if (!this._keyboard) {
      this._keyboard = new KeyboardInput();
      if (this._state === 'active') {
        this._keyboard.start();
      }
    }
    return this._keyboard;
  }

  /**
   * Builds the screen: create DOM in `layer`, create and load worlds, subscribe to things. Called
   * once, when the screen first comes on top of the stack. While the returned promise is pending
   * the layer is kept hidden and the manager shows its loading view, fed by `ctx.reportProgress`.
   *
   * Register everything that has to go away with the screen through `addWorld`/`addTeardown` as
   * soon as it exists, not at the end: if `enter()` throws or is aborted halfway, that is all that
   * gets cleaned up (`exit()` is not called for a screen that never finished entering).
   */
  public abstract enter(ctx: ScreenEnterContext): void | Promise<void>;

  /**
   * Called when the screen leaves the stack after having entered, before its teardowns run and its
   * worlds are disposed. May return a promise (a fade-out); the transition waits for it.
   */
  public exit(): void | Promise<void> {}

  /**
   * Called when another screen is put on top of this one. By now the manager has already made the
   * layer inert, switched off the input of this screen's worlds and (unless told otherwise) paused
   * them. Override for anything else the screen runs on its own.
   */
  public onCovered(): void {}

  /** Called when this screen is on top again, after its worlds got their input and clock back. */
  public onUncovered(): void {}

  /**
   * Hands a world to the screen: the manager switches its input off and pauses it while the screen
   * is covered, and it is disposed when the screen exits. Returns the world, for chaining.
   *
   * Call it right after creating the world, before loading into it. Whether a covered world is
   * paused is decided by the push that covers it (`pauseBelow`) and by the world itself: a world
   * with `localPauseAllowed === false` (a joined network session) keeps running. Its input is
   * switched off either way.
   */
  protected addWorld<W extends GgWorld<any, any>>(world: W): W {
    if (this._state === 'exited') {
      world.dispose();
      return world;
    }
    const owned: OwnedWorld = { world, pausedHere: false, inputDisabledHere: false };
    this.worlds.push(owned);
    if (this.covered) {
      this.coverWorld(owned);
    }
    return world;
  }

  /**
   * Registers something to clean up when the screen exits: a function to call, an rxjs
   * `Subscription` to unsubscribe, or anything with `dispose()`. They run in reverse order of
   * registration, before the screen's worlds are disposed.
   */
  protected addTeardown(teardown: ScreenTeardown): void {
    if (this._state === 'exited') {
      runTeardown(teardown);
      return;
    }
    this.teardowns.push(teardown);
  }

  private coverWorld(owned: OwnedWorld): void {
    const { world } = owned;
    if (world.inputEnabled) {
      world.inputEnabled = false;
      owned.inputDisabledHere = true;
    }
    if (this.pauseWhileCovered && world.localPauseAllowed && world.isRunning && !world.isPaused) {
      world.pauseWorld();
      owned.pausedHere = true;
    }
  }

  private uncoverWorld(owned: OwnedWorld): void {
    // only what was changed here is put back: a world the app paused itself stays paused
    if (owned.pausedHere) {
      owned.pausedHere = false;
      owned.world.resumeWorld();
    }
    if (owned.inputDisabledHere) {
      owned.inputDisabledHere = false;
      owned.world.inputEnabled = true;
    }
  }

  /** @internal The manager's side of the screen - see `ScreenInternals`. */
  public readonly internals: ScreenInternals = {
    attach: (manager, layer) => {
      this._manager = manager;
      this._layer = layer;
    },
    setState: state => {
      this._state = state;
      if (this._keyboard) {
        if (state === 'active') {
          this._keyboard.start();
        } else {
          this._keyboard.stop();
        }
      }
    },
    setCovered: (covered, pauseWorlds) => {
      if (covered === this.covered) {
        return;
      }
      this.covered = covered;
      if (covered) {
        this.pauseWhileCovered = pauseWorlds;
        this.worlds.forEach(owned => this.coverWorld(owned));
      } else {
        this.worlds.forEach(owned => this.uncoverWorld(owned));
      }
    },
    teardown: () => {
      this._state = 'exited';
      this._keyboard?.stop();
      for (const teardown of this.teardowns.splice(0).reverse()) {
        try {
          runTeardown(teardown);
        } catch (e) {
          console.error(e);
        }
      }
      for (const { world } of this.worlds.splice(0).reverse()) {
        try {
          world.dispose();
        } catch (e) {
          console.error(e);
        }
      }
      this._layer?.remove();
      this._layer = null;
    },
  };
}

function runTeardown(teardown: ScreenTeardown): void {
  if (typeof teardown === 'function') {
    teardown();
  } else if ('unsubscribe' in teardown) {
    teardown.unsubscribe();
  } else {
    teardown.dispose();
  }
}
