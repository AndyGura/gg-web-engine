import { LoadingScreen, LoadingView } from '../../../src';

describe('LoadingScreen', () => {
  const progress = (fraction: number) => ({
    fraction,
    loadedItems: 0,
    totalItems: 0,
    bytesLoaded: 0,
    bytesTotal: 0,
    current: null,
  });

  const fakeView = (): LoadingView & { setProgress: jest.Mock; dispose: jest.Mock } => {
    const element = document.createElement('div');
    return { element, setProgress: jest.fn(), dispose: jest.fn(() => element.remove()) };
  };

  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.useRealTimers();
    document.body.innerHTML = '';
  });

  it('covers the viewport with the default view until hidden, fading out first', () => {
    const screen = LoadingScreen.show();
    const holder = document.querySelector('.gg-loading-screen') as HTMLElement;
    expect(holder.style.position).toBe('fixed');
    expect(holder.querySelector('.gg-loading')).not.toBeNull();

    screen.hide();
    expect(screen.isHidden).toBe(true);
    expect(holder.style.opacity).toBe('0');
    expect(holder.isConnected).toBe(true);
    jest.advanceTimersByTime(250);
    expect(holder.isConnected).toBe(false);
  });

  it('shows a given view in a given container, forwards progress and disposes the view once', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const view = fakeView();
    const screen = LoadingScreen.show({ view, container, fadeOutDuration: 0 });
    expect(container.contains(view.element)).toBe(true);
    expect((container.firstChild as HTMLElement).style.position).toBe('absolute');

    screen.setProgress(progress(0.5));
    expect(view.setProgress).toHaveBeenCalledWith(progress(0.5));

    screen.hide();
    screen.hide();
    screen.setProgress(progress(0.9));
    expect(view.dispose).toHaveBeenCalledTimes(1);
    expect(view.setProgress).toHaveBeenCalledTimes(1);
    expect(container.childElementCount).toBe(0);
  });
});
