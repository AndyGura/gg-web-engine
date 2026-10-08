import { LoadProgress } from '../assets/load-progress';
import { DefaultLoadingView, LoadingView } from './loading-view';

export type LoadingScreenOptions = {
  /** The view to show. By default one made by the factory given to `LoadingScreen.setDefaultView`. */
  view?: LoadingView;
  /**
   * Where to show it. By default the screen covers the whole viewport, above the page (fixed, added
   * to `document.body`). An element of the app's own has to be positioned (`position: relative` or
   * the like), since the view is placed absolutely inside it.
   */
  container?: HTMLElement;
  /** How long, in milliseconds, `hide()` fades the screen out before removing it. 250 by default. */
  fadeOutDuration?: number;
};

/**
 * A loading view shown over the page (or one element) until `hide()`: the app decides what it
 * covers. Typically a game's startup or a level (re)load:
 *
 * ```ts
 * const loading = LoadingScreen.show(); // or LoadingScreen.show({ view: myOwnLoadingView })
 * await world.init();
 * await world.loader.loadLevel(level, 'Level', { onProgress: p => loading.setProgress(p) });
 * world.start();
 * loading.hide();
 * ```
 *
 * Without a `view` it shows the default view: a `DefaultLoadingView`, unless the game sets its own
 * once with `LoadingScreen.setDefaultView(() => new MyLoadingView())`. Any object implementing
 * `LoadingView` works.
 */
export class LoadingScreen {
  private static defaultViewFactory: () => LoadingView = () => new DefaultLoadingView();

  private readonly holder: HTMLElement;
  private readonly fadeOutDuration: number;
  private hidden = false;

  private constructor(
    public readonly view: LoadingView,
    container: HTMLElement | undefined,
    fadeOutDuration: number,
  ) {
    this.fadeOutDuration = fadeOutDuration;
    this.holder = document.createElement('div');
    this.holder.className = 'gg-loading-screen';
    Object.assign(this.holder.style, {
      position: container ? 'absolute' : 'fixed',
      inset: '0',
      zIndex: '10000',
      transition: `opacity ${fadeOutDuration}ms ease-out`,
    });
    this.holder.appendChild(view.element);
    (container ?? document.body).appendChild(this.holder);
  }

  /**
   * Sets how the default loading view is made, for `LoadingScreen.show()` without a `view` and for a
   * `ScreenManager` without a `loadingView`. A factory, not a view: each screen disposes its view when
   * it hides. `null` goes back to `DefaultLoadingView`.
   */
  public static setDefaultView(factory: (() => LoadingView) | null): void {
    LoadingScreen.defaultViewFactory = factory ?? (() => new DefaultLoadingView());
  }

  /** A new instance of the default loading view (see `setDefaultView`). */
  public static createDefaultView(): LoadingView {
    return LoadingScreen.defaultViewFactory();
  }

  /** Shows a loading view now and returns the handle that hides it. */
  public static show(options: LoadingScreenOptions = {}): LoadingScreen {
    return new LoadingScreen(
      options.view ?? LoadingScreen.createDefaultView(),
      options.container,
      options.fadeOutDuration ?? 250,
    );
  }

  /** Whether `hide()` has been called. */
  public get isHidden(): boolean {
    return this.hidden;
  }

  public setProgress(progress: LoadProgress): void {
    if (!this.hidden) {
      this.view.setProgress(progress);
    }
  }

  /** Fades the screen out, then removes it and disposes the view. Later calls do nothing. */
  public hide(): void {
    if (this.hidden) {
      return;
    }
    this.hidden = true;
    const remove = () => {
      this.view.dispose();
      this.holder.remove();
    };
    if (this.fadeOutDuration > 0) {
      this.holder.style.opacity = '0';
      this.holder.style.pointerEvents = 'none';
      setTimeout(remove, this.fadeOutDuration);
    } else {
      remove();
    }
  }
}
