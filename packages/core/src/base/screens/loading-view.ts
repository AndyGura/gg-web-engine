import { LoadProgress } from '../assets/load-progress';

/**
 * What a `ScreenManager` shows while a screen's `enter()` is pending. `element` is put on top of
 * every screen layer; `setProgress` is called with whatever the entering screen reports.
 */
export interface LoadingView {
  readonly element: HTMLElement;
  setProgress(progress: LoadProgress): void;
  dispose(): void;
}

/**
 * The loading view a `ScreenManager` uses unless given another: an opaque backdrop with a progress
 * bar and a percentage, plain DOM with inline styles. Restyle it through the `gg-loading` classes
 * (`gg-loading`, `gg-loading__bar`, `gg-loading__fill`, `gg-loading__label`), or replace it with
 * the manager's `loadingView` option.
 */
export class DefaultLoadingView implements LoadingView {
  public readonly element: HTMLElement;
  private readonly fill: HTMLElement;
  private readonly label: HTMLElement;

  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'gg-loading';
    this.element.setAttribute('role', 'progressbar');
    this.element.setAttribute('aria-valuemin', '0');
    this.element.setAttribute('aria-valuemax', '100');
    Object.assign(this.element.style, {
      position: 'absolute',
      inset: '0',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '12px',
      background: '#111',
      color: '#ddd',
      font: '14px system-ui, sans-serif',
    });
    const bar = document.createElement('div');
    bar.className = 'gg-loading__bar';
    Object.assign(bar.style, {
      width: 'min(60%, 320px)',
      height: '6px',
      borderRadius: '3px',
      background: '#333',
      overflow: 'hidden',
    });
    this.fill = document.createElement('div');
    this.fill.className = 'gg-loading__fill';
    Object.assign(this.fill.style, {
      width: '0%',
      height: '100%',
      background: '#ddd',
      transition: 'width 120ms linear',
    });
    bar.appendChild(this.fill);
    this.label = document.createElement('div');
    this.label.className = 'gg-loading__label';
    this.element.append(bar, this.label);
    this.setProgress({ fraction: 0, loadedItems: 0, totalItems: 0, bytesLoaded: 0, bytesTotal: 0, current: null });
  }

  public setProgress(progress: LoadProgress): void {
    const percent = Math.round(Math.min(1, Math.max(0, progress.fraction)) * 100);
    this.fill.style.width = `${percent}%`;
    this.label.textContent = `${percent}%`;
    this.element.setAttribute('aria-valuenow', `${percent}`);
  }

  public dispose(): void {
    this.element.remove();
  }
}
