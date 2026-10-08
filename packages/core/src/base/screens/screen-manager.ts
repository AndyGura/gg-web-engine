import { BehaviorSubject, Observable } from 'rxjs';
import { isAbortError, LoadProgress } from '../assets/load-progress';
import { LoadingScreen } from './loading-screen';
import { LoadingView } from './loading-view';
import { Screen } from './screen';

export type ScreenManagerOptions = {
  /**
   * The element screens are laid out in. By default the manager creates one covering the viewport
   * and adds it to `document.body`. An element of the app's own has to be positioned
   * (`position: relative` or the like), since screen layers are placed absolutely inside it.
   */
  container?: HTMLElement;
  /**
   * Creates the view shown while a screen is entering. By default the game-wide default view (see
   * `LoadingScreen.setDefaultView`, `DefaultLoadingView` unless set); `null` for none (screens that
   * show their own progress).
   */
  loadingView?: (() => LoadingView) | null;
  /**
   * How long, in milliseconds, a screen may take to enter before the loading view appears - so a
   * screen that is ready at once never flashes it. 150 by default.
   */
  loadingDelay?: number;
  /**
   * Once the loading view has appeared, the least time in milliseconds it stays, so a screen ready
   * just after the delay doesn't flash it for a frame. 300 by default.
   */
  loadingMinDuration?: number;
  /**
   * Called when a screen's `enter()` throws (not when it is aborted). Return a screen to show in its
   * place - an error screen, the main menu - so a failed `replace` or `clearHistory` push doesn't
   * leave an empty stack. The operation then resolves with `false` instead of rejecting. Called once
   * per operation: if the returned screen fails too, the operation rejects.
   */
  onEnterError?: (error: unknown, screen: Screen) => Screen | null | undefined | void;
};

export type ScreenPushOptions = {
  /** Removes every screen currently in the stack: the pushed screen becomes the only one. */
  clearHistory?: boolean;
  /**
   * Whether the worlds of the screen that gets covered are paused. `true` by default. A world whose
   * `localPauseAllowed` is `false` keeps running regardless, and input of covered worlds is
   * switched off regardless.
   */
  pauseBelow?: boolean;
  /** Overrides the manager's `loadingView` for this transition. */
  loadingView?: (() => LoadingView) | null;
};

type ScreenClass = abstract new (...args: any[]) => Screen;

const EMPTY_PROGRESS: LoadProgress = {
  fraction: 0,
  loadedItems: 0,
  totalItems: 0,
  bytesLoaded: 0,
  bytesTotal: 0,
  current: null,
};

/**
 * Keeps an app's screens as a stack and moves between them: the top screen is the one the player
 * sees and controls, the ones below are covered (inert, silenced, by default paused) until they
 * are on top again.
 *
 * ```ts
 * const screens = new ScreenManager();
 * screens.push(new MenuScreen());
 * // from the menu:   this.screens.push(new GameScreen('city'), { clearHistory: true });
 * // from the game:   this.screens.push(new PauseScreen());
 * // from the pause:  this.screens.pop();  or  this.screens.reset([new MenuScreen()]);
 * ```
 *
 * Every operation is one transition, and transitions run one after another in the order they were
 * requested: first the screens that leave exit, top down (so a game being replaced has given up
 * its renderer and audio before the next screen allocates its own); then the screen that ends up on
 * top is entered if it never was, or uncovered. Screens placed below the top by `reset` enter
 * later, when they are first uncovered. The layers of the screens that left stay on the page until
 * the new top screen (or the loading view) shows, so there is no blank frame in between.
 *
 * Each operation returns a promise that resolves when its transition is over: with `true` when its
 * top screen is shown (or the stack is empty), with `false` when a later request cancelled it. It
 * rejects if the entered screen's `enter()` threw - that screen is then removed again and the one
 * below it shown - unless `onEnterError` provided a screen to show instead.
 *
 * A plain `push` waits for the screens being entered before it. Any other operation cancels the
 * screens it removes that were not shown yet, judged by the stack as the operations queued before
 * it leave it: one entering is aborted (its `ctx.signal`), one whose operation still waits is never
 * entered. So going back during a long load cancels the load, and `push(a); push(b); pop()` never
 * enters `b`.
 *
 * Never await an operation from a screen's own `enter()` or `exit()`: it waits for the transition
 * that is waiting for that very hook, and neither ends. Call it without awaiting instead.
 */
export class ScreenManager {
  /** The element the screen layers are in. */
  public readonly container: HTMLElement;
  private readonly ownsContainer: boolean;
  private readonly loadingViewFactory: (() => LoadingView) | null;
  private readonly loadingDelay: number;
  private readonly loadingMinDuration: number;
  private readonly onEnterError: ScreenManagerOptions['onEnterError'];
  /** Every manager alive, for the dev console commands they share. */
  private static readonly managers: ScreenManager[] = [];

  private readonly _stack$: BehaviorSubject<readonly Screen[]> = new BehaviorSubject<readonly Screen[]>([]);
  private readonly _busy$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
  private queue: Promise<void> = Promise.resolve();
  private pending = 0;
  /** The stack as it will be once every queued operation has run. */
  private projected: readonly Screen[] = [];
  /** Screens removed by a later operation before they were shown. */
  private readonly cancelled: Set<Screen> = new Set<Screen>();
  private readonly enteringControllers: Map<Screen, AbortController> = new Map<Screen, AbortController>();
  /** Cancelled screens that were put in the stack: the operation that cancelled them takes them out. */
  private readonly aborted: Set<Screen> = new Set<Screen>();
  /** `pointerEvents` of a covered screen's layer as the screen had it, put back on uncover. */
  private readonly pointerEventsBeforeCover: WeakMap<Screen, string> = new WeakMap<Screen, string>();
  private disposed = false;
  private disposing: Promise<void> | null = null;

  /** The screens, bottom first. */
  public get stack(): readonly Screen[] {
    return this._stack$.value;
  }

  /** The screen on top of the stack, `null` when the stack is empty. */
  public get top(): Screen | null {
    const stack = this._stack$.value;
    return stack.length ? stack[stack.length - 1] : null;
  }

  /** The current stack on subscription, then every change of it. */
  public get stack$(): Observable<readonly Screen[]> {
    return this._stack$.asObservable();
  }

  /** `true` while a transition is running or waiting. */
  public get busy$(): Observable<boolean> {
    return this._busy$.asObservable();
  }

  constructor(options: ScreenManagerOptions = {}) {
    if (options.container) {
      this.container = options.container;
      this.ownsContainer = false;
    } else {
      this.container = document.createElement('div');
      this.container.className = 'gg-screens';
      Object.assign(this.container.style, { position: 'fixed', inset: '0', overflow: 'hidden', isolation: 'isolate' });
      document.body.appendChild(this.container);
      this.ownsContainer = true;
    }
    this.loadingViewFactory =
      options.loadingView === undefined ? () => LoadingScreen.createDefaultView() : options.loadingView;
    this.loadingDelay = options.loadingDelay ?? 150;
    this.loadingMinDuration = options.loadingMinDuration ?? 300;
    this.onEnterError = options.onEnterError;
    ScreenManager.managers.push(this);
    this.onGgStaticAdded = this.onGgStaticAdded.bind(this);
    if (typeof window !== 'undefined') {
      if ((window as any).ggstatic) {
        ScreenManager.registerConsoleCommands();
      } else {
        window.addEventListener('ggstatic_added', this.onGgStaticAdded);
      }
    }
  }

  /** Puts `screen` on top of the stack, covering the current top screen. */
  public push(screen: Screen, options: ScreenPushOptions = {}): Promise<boolean> {
    return this.request(
      !!options.clearHistory,
      stack => (options.clearHistory ? [screen] : [...stack, screen]),
      options,
    );
  }

  /** Puts `screen` in place of the top screen, which exits. */
  public replace(screen: Screen, options: ScreenPushOptions = {}): Promise<boolean> {
    return this.request(true, stack => (options.clearHistory ? [screen] : [...stack.slice(0, -1), screen]), options);
  }

  /**
   * Removes the top `count` screens (one by default); the screen below them is on top again.
   * @throws (rejects) if `count` is not a positive integer
   */
  public pop(count: number = 1): Promise<boolean> {
    if (!Number.isInteger(count) || count < 1) {
      return Promise.reject(new RangeError(`ScreenManager.pop: count must be a positive integer, got ${count}`));
    }
    return this.request(true, stack => stack.slice(0, Math.max(0, stack.length - count)), {});
  }

  /**
   * Removes every screen above `target`, which is a screen of the stack or a screen class (then the
   * topmost screen of that class).
   * @throws (rejects) if the stack has no such screen
   */
  public popTo(target: Screen | ScreenClass): Promise<boolean> {
    return this.request(
      true,
      stack => {
        let index = -1;
        for (let i = stack.length - 1; i >= 0; i--) {
          if (typeof target === 'function' ? stack[i] instanceof target : stack[i] === target) {
            index = i;
            break;
          }
        }
        if (index < 0) {
          throw new Error('ScreenManager.popTo: no such screen in the stack');
        }
        return stack.slice(0, index + 1);
      },
      {},
    );
  }

  /**
   * Makes the stack exactly `screens` (bottom first) in one transition. Screens already in the
   * stack that are listed again stay as they are; the rest exit. Only the last one is entered now.
   */
  public reset(screens: Screen[], options: ScreenPushOptions = {}): Promise<boolean> {
    return this.request(true, () => [...screens], options);
  }

  /** Exits every screen and removes what the manager added to the page. */
  public dispose(): Promise<void> {
    // one disposal, shared by every caller: a second one must not detach another manager
    if (!this.disposing) {
      this.disposing = this.doDispose();
    }
    return this.disposing;
  }

  private async doDispose(): Promise<void> {
    await this.reset([]);
    this.disposed = true;
    ScreenManager.managers.splice(ScreenManager.managers.indexOf(this), 1);
    if (typeof window !== 'undefined') {
      window.removeEventListener('ggstatic_added', this.onGgStaticAdded);
      if (!ScreenManager.managers.length) {
        const ggstatic = (window as any).ggstatic;
        ggstatic?.deregisterConsoleCommand?.(null, 'screens');
        ggstatic?.deregisterConsoleCommand?.(null, 'screen_pop');
      }
    }
    if (this.ownsContainer) {
      this.container.remove();
    }
    this._stack$.complete();
    this._busy$.complete();
  }

  /**
   * Queues one operation. `wanted` computes the stack the operation leads to from the one before
   * it: applied now to `projected` (the stack once every queued operation has run), it tells which
   * screens this operation removes; applied again when the operation's turn comes, to the real
   * stack, it drives the transition.
   */
  private request(
    supersedes: boolean,
    wanted: (stack: readonly Screen[]) => Screen[],
    options: ScreenPushOptions,
  ): Promise<boolean> {
    if (this.disposed) {
      return Promise.reject(new Error('The ScreenManager is disposed'));
    }
    const before = this.projected.filter(screen => screen.state !== 'exited');
    let after = before;
    try {
      after = wanted(before);
    } catch {
      // fails again when its turn comes, and is reported then
    }
    if (supersedes) {
      // a screen this operation removes before it was shown is cancelled: aborted while entering,
      // never entered while its request still waits
      for (const screen of before) {
        if (!after.includes(screen) && (screen.state === 'pending' || screen.state === 'entering')) {
          this.cancelled.add(screen);
          this.enteringControllers.get(screen)?.abort();
        }
      }
    }
    this.projected = after;
    this.pending++;
    if (this.pending === 1) {
      this._busy$.next(true);
    }
    const result = this.queue.then(async () => {
      try {
        return await this.transition(wanted(this.stack), options);
      } catch (e) {
        await this.removeAborted();
        throw e;
      }
    });
    this.queue = result
      .catch(() => {})
      .then(() => {
        this.pending--;
        if (this.pending === 0 && !this._busy$.closed) {
          this._busy$.next(false);
          // nothing queued: the projection is the stack
          this.projected = this.stack;
        }
      });
    return result;
  }

  /** @returns whether the top screen ended up shown (`false`: a later request cancelled it) */
  private async transition(wanted: Screen[], options: ScreenPushOptions): Promise<boolean> {
    // a screen whose entering was aborted is gone whatever the request says
    const next = wanted.filter(screen => !this.aborted.has(screen));
    for (const screen of next) {
      if (screen.state === 'exited') {
        throw new Error('A screen that has exited cannot be shown again: create a new instance');
      }
      if (next.indexOf(screen) !== next.lastIndexOf(screen)) {
        throw new Error('The same screen instance cannot be in the stack twice');
      }
    }
    const current = this.stack;
    // layers of the screens leaving stay up, inert, until what replaces them is shown
    const leaving: HTMLElement[] = [];
    const dropLeaving = () => leaving.splice(0).forEach(layer => layer.remove());
    try {
      for (const screen of [...current].reverse()) {
        if (!next.includes(screen)) {
          const layer = screen.layer;
          layer.setAttribute('inert', '');
          leaving.push(layer);
          await this.exitScreen(screen, true, true);
        }
      }
      for (const screen of next) {
        if (!current.includes(screen)) {
          this.attach(screen);
        }
      }
      this.setStack(next);

      let error: { error: unknown } | null = null;
      let fallbackUsed = false;
      while (this.stack.length) {
        const stack = this.stack;
        const top = stack[stack.length - 1];
        if (top.state === 'pending' && this.cancelled.has(top)) {
          // cancelled before it started: never entered, the request that cancelled it removes it
          this.aborted.add(top);
          return false;
        }
        for (const screen of stack) {
          if (screen !== top && screen.state === 'active') {
            this.cover(screen, options.pauseBelow ?? true);
          }
        }
        if (top.state === 'covered') {
          dropLeaving();
          this.uncover(top);
          break;
        }
        if (top.state !== 'pending') {
          break;
        }
        const outcome = await this.enterScreen(top, options, dropLeaving);
        if (outcome === 'aborted') {
          return false;
        }
        if (outcome === 'entered') {
          // entered, but a later request already removes it: that request exits it, not shown
          return !fallbackUsed && !this.cancelled.has(top);
        }
        // enter() threw: the screen is gone, show its replacement or what is below it
        const fallback = fallbackUsed ? null : this.fallbackFor(outcome.error, top);
        fallbackUsed = true;
        if (fallback) {
          this.attach(fallback);
          this.setStack([...this.stack, fallback]);
          // the fallback stands where the failed screen stood, so that a request made while it
          // enters sees it and can cancel it
          this.projected = this.projected.map(screen => (screen === top ? fallback : screen));
        }
        error = fallback ? null : (error ?? outcome);
      }
      if (error) {
        throw error.error;
      }
      return !fallbackUsed;
    } finally {
      dropLeaving();
    }
  }

  private attach(screen: Screen): void {
    const layer = document.createElement('div');
    layer.className = 'gg-screen';
    Object.assign(layer.style, { position: 'absolute', inset: '0', isolation: 'isolate', visibility: 'hidden' });
    screen.internals.attach(this, layer);
  }

  private fallbackFor(error: unknown, screen: Screen): Screen | null {
    if (!this.onEnterError) {
      return null;
    }
    let fallback: Screen | null | void;
    try {
      fallback = this.onEnterError(error, screen);
    } catch (e) {
      console.error(e);
      return null;
    }
    if (!fallback) {
      return null;
    }
    // the same rules a requested screen gets: a fresh instance, not already in the stack
    if (fallback.state === 'exited') {
      console.error(new Error('onEnterError returned a screen that has exited: create a new instance'));
      return null;
    }
    if (this.stack.includes(fallback)) {
      console.error(new Error('onEnterError returned a screen that is already in the stack'));
      return null;
    }
    return fallback;
  }

  /**
   * A request that aborted the entering screen and then failed before its transition took that
   * screen out leaves it on top, never shown: remove it and give the screen below back.
   */
  private async removeAborted(): Promise<void> {
    if (!this.stack.some(screen => this.aborted.has(screen))) {
      return;
    }
    try {
      await this.transition([...this.stack], {});
    } catch (e) {
      console.error(e);
    }
  }

  private setStack(stack: Screen[]): void {
    stack.forEach((screen, index) => {
      const layer = screen.layer;
      layer.style.zIndex = `${index}`;
      // document order follows stack order too, for focus order and assistive technology
      this.container.appendChild(layer);
    });
    this._stack$.next(stack);
  }

  private cover(screen: Screen, pauseWorlds: boolean): void {
    screen.layer.setAttribute('inert', '');
    this.pointerEventsBeforeCover.set(screen, screen.layer.style.pointerEvents);
    screen.layer.style.pointerEvents = 'none';
    screen.internals.setCovered(true, pauseWorlds);
    screen.internals.setState('covered');
    this.safely(() => screen.onCovered());
  }

  private uncover(screen: Screen): void {
    screen.layer.removeAttribute('inert');
    screen.layer.style.pointerEvents = this.pointerEventsBeforeCover.get(screen) ?? '';
    this.pointerEventsBeforeCover.delete(screen);
    screen.internals.setCovered(false, false);
    screen.internals.setState('active');
    this.safely(() => screen.onUncovered());
  }

  private async enterScreen(
    screen: Screen,
    options: ScreenPushOptions,
    onShown: () => void,
  ): Promise<'entered' | 'aborted' | { error: unknown }> {
    // aborted by a later request that removes the screen
    const controller = new AbortController();
    this.enteringControllers.set(screen, controller);
    screen.internals.setState('entering');

    const factory = options.loadingView === undefined ? this.loadingViewFactory : options.loadingView;
    let view: LoadingView | null = null;
    let viewShownAt = 0;
    let last: LoadProgress = EMPTY_PROGRESS;
    const timer = factory
      ? setTimeout(() => {
          view = factory();
          view.element.style.zIndex = '2147483647';
          view.setProgress(last);
          this.container.appendChild(view.element);
          viewShownAt = Date.now();
          onShown();
        }, this.loadingDelay)
      : null;
    const reportProgress = (progress: LoadProgress | number) => {
      last = typeof progress === 'number' ? { ...EMPTY_PROGRESS, fraction: progress } : progress;
      view?.setProgress(last);
    };

    let failure: { error: unknown } | null = null;
    // `enter()` ran to its end before any abort: the screen is in, whatever comes after
    let entered = false;
    try {
      await screen.enter({ signal: controller.signal, reportProgress });
      entered = !controller.signal.aborted;
    } catch (e) {
      failure = { error: e };
    }
    if (timer !== null) {
      clearTimeout(timer);
    }
    if (view && entered) {
      // a loading view that has just appeared doesn't vanish again within a frame; an abort only
      // cuts the wait short, the request behind it exits the screen as an entered one
      await sleep(this.loadingMinDuration - (Date.now() - viewShownAt), controller.signal);
    }
    (view as LoadingView | null)?.dispose();
    this.enteringControllers.delete(screen);

    if (!entered && controller.signal.aborted) {
      // left in the stack for the request that aborted it: its transition takes it out
      this.aborted.add(screen);
      if (failure && !isAbortError(failure.error)) {
        console.error(failure.error);
      }
      return 'aborted';
    }
    if (failure) {
      await this.exitScreen(screen, false);
      this.setStack(this.stack.filter(s => s !== screen));
      return failure;
    }
    onShown();
    if (!controller.signal.aborted) {
      // a screen on its way out again stays hidden: the stack above it already changed
      screen.layer.style.visibility = '';
    }
    screen.internals.setState('active');
    return 'entered';
  }

  private async exitScreen(screen: Screen, entered: boolean = true, keepLayer: boolean = false): Promise<void> {
    const wasEntered = entered && (screen.state === 'active' || screen.state === 'covered');
    this.aborted.delete(screen);
    this.cancelled.delete(screen);
    if (wasEntered) {
      try {
        await screen.exit();
      } catch (e) {
        console.error(e);
      }
    }
    screen.internals.teardown(keepLayer);
  }

  private safely(run: () => void): void {
    try {
      run();
    } catch (e) {
      console.error(e);
    }
  }

  private onGgStaticAdded(): void {
    window.removeEventListener('ggstatic_added', this.onGgStaticAdded);
    ScreenManager.registerConsoleCommands();
  }

  private describeStack(indent: string): string {
    if (!this.stack.length) {
      return `${indent}(no screens)`;
    }
    return this.stack
      .map((screen, index) => {
        const type = (screen.constructor as typeof Screen).screenTypeName ?? screen.constructor.name;
        return `${indent}${index}: ${type} (${screen.state})`;
      })
      .join('\n');
  }

  // the dev console is reached only through `window.ggstatic`, and only when the app created it;
  // the commands are shared by every manager alive
  private static registerConsoleCommands(): void {
    const ggstatic = (window as any).ggstatic;
    if (!ggstatic?.registerConsoleCommand) {
      return;
    }
    const managers = ScreenManager.managers;
    ggstatic.registerConsoleCommand(
      null,
      'screens',
      async () =>
        managers.length === 1
          ? managers[0].describeStack('')
          : managers.map((m, i) => `manager ${i}:\n${m.describeStack('  ')}`).join('\n'),
      'no args; Print the screen stack, bottom first, with the state of every screen',
    );
    ggstatic.registerConsoleCommand(
      null,
      'screen_pop',
      async (...args: string[]) => {
        const count = args[0] === undefined ? 1 : +args[0];
        const index = args[1] === undefined ? 0 : +args[1];
        const manager = managers[index];
        if (!Number.isInteger(count) || count < 1 || !manager) {
          throw new Error('usage: screen_pop [COUNT] [MANAGER]');
        }
        await manager.pop(count);
        return `popped, ${manager.stack.length} screen(s) left`;
      },
      'args: [ int?, int? ]; Remove the top screen (or the given number of screens) from the screen stack ' +
        '(of the given manager, as listed by screens, when there are several)',
    );
  }
}

/** Resolves after `ms` (at once when not positive), or as soon as `signal` aborts. */
function sleep(ms: number, signal: AbortSignal): Promise<void> {
  if (ms <= 0 || signal.aborted) {
    return Promise.resolve();
  }
  return new Promise(resolve => {
    const done = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    signal.addEventListener('abort', done);
  });
}
