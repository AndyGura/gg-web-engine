import { BehaviorSubject, Observable } from 'rxjs';
import { isAbortError, LoadProgress } from '../assets/load-progress';
import { DefaultLoadingView, LoadingView } from './loading-view';
import { Screen } from './screen';

export type ScreenManagerOptions = {
  /**
   * The element screens are laid out in. By default the manager creates one covering the viewport
   * and adds it to `document.body`. An element of the app's own has to be positioned
   * (`position: relative` or the like), since screen layers are placed absolutely inside it.
   */
  container?: HTMLElement;
  /**
   * Creates the view shown while a screen is entering. `DefaultLoadingView` by default; `null` for
   * none (screens that show their own progress).
   */
  loadingView?: (() => LoadingView) | null;
  /**
   * How long, in milliseconds, a screen may take to enter before the loading view appears - so a
   * screen that is ready at once never flashes it. 150 by default.
   */
  loadingDelay?: number;
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
 * later, when they are first uncovered. Each operation returns a promise that resolves when its
 * transition is over, and rejects if the entered screen's `enter()` threw - that screen is then
 * removed again and the one below it shown.
 *
 * A request made while a screen is still entering waits for it if it is a plain `push`; any other
 * request aborts the entering screen (its `ctx.signal`) and goes on from there, so going back
 * during a long load cancels the load.
 */
export class ScreenManager {
  /** The element the screen layers are in. */
  public readonly container: HTMLElement;
  private readonly ownsContainer: boolean;
  private readonly loadingViewFactory: (() => LoadingView) | null;
  private readonly loadingDelay: number;

  private readonly _stack$: BehaviorSubject<readonly Screen[]> = new BehaviorSubject<readonly Screen[]>([]);
  private readonly _busy$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
  private queue: Promise<void> = Promise.resolve();
  private pending = 0;
  private entering: { screen: Screen; controller: AbortController } | null = null;
  private readonly aborted: Set<Screen> = new Set<Screen>();
  private disposed = false;

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
    this.loadingViewFactory = options.loadingView === undefined ? () => new DefaultLoadingView() : options.loadingView;
    this.loadingDelay = options.loadingDelay ?? 150;
    this.onGgStaticAdded = this.onGgStaticAdded.bind(this);
    if (typeof window !== 'undefined') {
      if ((window as any).ggstatic) {
        this.registerConsoleCommands();
      } else {
        window.addEventListener('ggstatic_added', this.onGgStaticAdded);
      }
    }
  }

  /** Puts `screen` on top of the stack, covering the current top screen. */
  public push(screen: Screen, options: ScreenPushOptions = {}): Promise<void> {
    return this.request(!!options.clearHistory, () =>
      this.transition(options.clearHistory ? [screen] : [...this.stack, screen], options),
    );
  }

  /** Puts `screen` in place of the top screen, which exits. */
  public replace(screen: Screen, options: ScreenPushOptions = {}): Promise<void> {
    return this.request(true, () =>
      this.transition(options.clearHistory ? [screen] : [...this.stack.slice(0, -1), screen], options),
    );
  }

  /** Removes the top `count` screens (one by default); the screen below them is on top again. */
  public pop(count: number = 1): Promise<void> {
    return this.request(true, () => this.transition(this.stack.slice(0, Math.max(0, this.stack.length - count)), {}));
  }

  /**
   * Removes every screen above `target`, which is a screen of the stack or a screen class (then the
   * topmost screen of that class).
   * @throws (rejects) if the stack has no such screen
   */
  public popTo(target: Screen | ScreenClass): Promise<void> {
    return this.request(true, () => {
      const stack = this.stack;
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
      return this.transition(stack.slice(0, index + 1), {});
    });
  }

  /**
   * Makes the stack exactly `screens` (bottom first) in one transition. Screens already in the
   * stack that are listed again stay as they are; the rest exit. Only the last one is entered now.
   */
  public reset(screens: Screen[], options: ScreenPushOptions = {}): Promise<void> {
    return this.request(true, () => this.transition([...screens], options));
  }

  /** Exits every screen and removes what the manager added to the page. */
  public async dispose(): Promise<void> {
    if (this.disposed) {
      return;
    }
    await this.reset([]);
    this.disposed = true;
    if (typeof window !== 'undefined') {
      window.removeEventListener('ggstatic_added', this.onGgStaticAdded);
      const ggstatic = (window as any).ggstatic;
      ggstatic?.deregisterConsoleCommand?.(null, 'screens');
      ggstatic?.deregisterConsoleCommand?.(null, 'screen_pop');
    }
    if (this.ownsContainer) {
      this.container.remove();
    }
    this._stack$.complete();
    this._busy$.complete();
  }

  private request(supersedes: boolean, run: () => Promise<void>): Promise<void> {
    if (this.disposed) {
      return Promise.reject(new Error('The ScreenManager is disposed'));
    }
    if (supersedes && this.entering) {
      this.aborted.add(this.entering.screen);
      this.entering.controller.abort();
    }
    this.pending++;
    if (this.pending === 1) {
      this._busy$.next(true);
    }
    const result = this.queue.then(run);
    this.queue = result
      .catch(() => {})
      .then(() => {
        this.pending--;
        if (this.pending === 0 && !this._busy$.closed) {
          this._busy$.next(false);
        }
      });
    return result;
  }

  private async transition(wanted: Screen[], options: ScreenPushOptions): Promise<void> {
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
    for (const screen of [...current].reverse()) {
      if (!next.includes(screen)) {
        await this.exitScreen(screen);
      }
    }
    for (const screen of next) {
      if (!current.includes(screen)) {
        const layer = document.createElement('div');
        layer.className = 'gg-screen';
        Object.assign(layer.style, { position: 'absolute', inset: '0', isolation: 'isolate', visibility: 'hidden' });
        screen.internals.attach(this, layer);
      }
    }
    this.setStack(next);

    let error: unknown = undefined;
    while (this.stack.length) {
      const stack = this.stack;
      const top = stack[stack.length - 1];
      for (const screen of stack) {
        if (screen !== top && screen.state === 'active') {
          this.cover(screen, options.pauseBelow ?? true);
        }
      }
      if (top.state === 'covered') {
        this.uncover(top);
        break;
      }
      if (top.state !== 'pending') {
        break;
      }
      const outcome = await this.enterScreen(top, options);
      if (outcome === 'entered' || outcome === 'aborted') {
        break;
      }
      // enter() threw: the screen is gone, show what is below it
      error = error ?? outcome.error;
    }
    if (error !== undefined) {
      throw error;
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
    screen.layer.style.pointerEvents = 'none';
    screen.internals.setCovered(true, pauseWorlds);
    screen.internals.setState('covered');
    this.safely(() => screen.onCovered());
  }

  private uncover(screen: Screen): void {
    screen.layer.removeAttribute('inert');
    screen.layer.style.pointerEvents = '';
    screen.internals.setCovered(false, false);
    screen.internals.setState('active');
    this.safely(() => screen.onUncovered());
  }

  private async enterScreen(
    screen: Screen,
    options: ScreenPushOptions,
  ): Promise<'entered' | 'aborted' | { error: unknown }> {
    const controller = new AbortController();
    this.entering = { screen, controller };
    screen.internals.setState('entering');

    const factory = options.loadingView === undefined ? this.loadingViewFactory : options.loadingView;
    let view: LoadingView | null = null;
    let last: LoadProgress = EMPTY_PROGRESS;
    const timer = factory
      ? setTimeout(() => {
          view = factory();
          view.element.style.zIndex = '2147483647';
          view.setProgress(last);
          this.container.appendChild(view.element);
        }, this.loadingDelay)
      : null;
    const reportProgress = (progress: LoadProgress | number) => {
      last = typeof progress === 'number' ? { ...EMPTY_PROGRESS, fraction: progress } : progress;
      view?.setProgress(last);
    };

    let failure: { error: unknown } | null = null;
    try {
      await screen.enter({ signal: controller.signal, reportProgress });
    } catch (e) {
      failure = { error: e };
    }
    if (timer !== null) {
      clearTimeout(timer);
    }
    (view as LoadingView | null)?.dispose();
    this.entering = null;

    if (controller.signal.aborted) {
      // left in the stack for the request that aborted it: its transition takes it out
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
    screen.layer.style.visibility = '';
    screen.internals.setState('active');
    return 'entered';
  }

  private async exitScreen(screen: Screen, entered: boolean = true): Promise<void> {
    const wasEntered = entered && (screen.state === 'active' || screen.state === 'covered');
    this.aborted.delete(screen);
    if (wasEntered) {
      try {
        await screen.exit();
      } catch (e) {
        console.error(e);
      }
    }
    screen.internals.teardown();
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
    this.registerConsoleCommands();
  }

  // the dev console is reached only through `window.ggstatic`, and only when the app created it
  private registerConsoleCommands(): void {
    const ggstatic = (window as any).ggstatic;
    if (!ggstatic?.registerConsoleCommand) {
      return;
    }
    ggstatic.registerConsoleCommand(
      null,
      'screens',
      async () =>
        this.stack.length
          ? this.stack.map((screen, index) => `${index}: ${screen.constructor.name} (${screen.state})`).join('\n')
          : '(no screens)',
      'no args; Print the screen stack, bottom first, with the state of every screen',
    );
    ggstatic.registerConsoleCommand(
      null,
      'screen_pop',
      async (...args: string[]) => {
        const count = args[0] === undefined ? 1 : +args[0];
        if (isNaN(count) || count < 1) {
          throw new Error('usage: screen_pop [COUNT]');
        }
        await this.pop(count);
        return `popped, ${this.stack.length} screen(s) left`;
      },
      'args: [ int? ]; Remove the top screen (or the given number of screens) from the screen stack',
    );
  }
}
