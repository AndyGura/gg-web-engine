import { fullscreen$, fullscreenElement, isFullscreenAvailable, toggleFullscreen } from '../src';

/** Stubs (or removes, with `undefined`) a member of `document` or an element for one test. */
const stubs: { target: any; key: string; had: boolean; value: any }[] = [];
const stub = (target: any, key: string, value: any) => {
  stubs.push({ target, key, had: Object.prototype.hasOwnProperty.call(target, key), value: target[key] });
  Object.defineProperty(target, key, { configurable: true, writable: true, value });
};

describe('fullscreen helpers', () => {
  afterEach(() => {
    while (stubs.length) {
      const { target, key, had, value } = stubs.pop()!;
      if (had) {
        Object.defineProperty(target, key, { configurable: true, writable: true, value });
      } else {
        delete target[key];
      }
    }
  });

  /** A browser with the standard API, entering and leaving fullscreen at once */
  const standardApi = (element: Element) => {
    let current: Element | null = null;
    stub(document, 'fullscreenEnabled', true);
    Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => current });
    stubs.push({ target: document, key: 'fullscreenElement', had: false, value: undefined });
    const request = jest.fn(async () => {
      current = element;
      document.dispatchEvent(new Event('fullscreenchange'));
    });
    const exit = jest.fn(async () => {
      current = null;
      document.dispatchEvent(new Event('fullscreenchange'));
    });
    stub(element, 'requestFullscreen', request);
    stub(document, 'exitFullscreen', exit);
    return { request, exit };
  };

  it('is unavailable without the API, and resolves false instead of throwing', async () => {
    // jsdom has no Fullscreen API, like Safari on an iPhone
    expect(isFullscreenAvailable()).toBe(false);
    expect(fullscreenElement()).toBeNull();
    await expect(toggleFullscreen()).resolves.toBe(false);
  });

  it('is unavailable where the page may not use it, though the element has the method', async () => {
    const element = document.createElement('div');
    const request = jest.fn();
    stub(element, 'requestFullscreen', request);
    stub(document, 'fullscreenEnabled', false);
    expect(isFullscreenAvailable(element)).toBe(false);
    await expect(toggleFullscreen(element)).resolves.toBe(false);
    expect(request).not.toHaveBeenCalled();
  });

  it('enters and leaves fullscreen through the standard API, reporting the state', async () => {
    const element = document.createElement('div');
    const { request, exit } = standardApi(element);
    const states: boolean[] = [];
    const subscription = fullscreen$().subscribe(v => states.push(v));
    expect(isFullscreenAvailable(element)).toBe(true);

    await expect(toggleFullscreen(element)).resolves.toBe(true);
    expect(request).toHaveBeenCalledTimes(1);
    expect(fullscreenElement()).toBe(element);

    await expect(toggleFullscreen(element)).resolves.toBe(true);
    expect(exit).toHaveBeenCalledTimes(1);
    expect(states).toEqual([false, true, false]);
    subscription.unsubscribe();
  });

  it('uses the WebKit-prefixed API, whose request returns nothing', async () => {
    const element = document.createElement('div');
    let current: Element | null = null;
    stub(document, 'webkitFullscreenEnabled', true);
    Object.defineProperty(document, 'webkitFullscreenElement', { configurable: true, get: () => current });
    stubs.push({ target: document, key: 'webkitFullscreenElement', had: false, value: undefined });
    const request = jest.fn(() => {
      current = element;
      document.dispatchEvent(new Event('webkitfullscreenchange'));
    });
    const exit = jest.fn(() => {
      current = null;
      document.dispatchEvent(new Event('webkitfullscreenchange'));
    });
    stub(element, 'webkitRequestFullscreen', request);
    stub(document, 'webkitExitFullscreen', exit);
    const states: boolean[] = [];
    const subscription = fullscreen$().subscribe(v => states.push(v));

    expect(isFullscreenAvailable(element)).toBe(true);
    await expect(toggleFullscreen(element)).resolves.toBe(true);
    expect(fullscreenElement()).toBe(element);
    await expect(toggleFullscreen()).resolves.toBe(true);
    expect(exit).toHaveBeenCalledTimes(1);
    expect(states).toEqual([false, true, false]);
    subscription.unsubscribe();
  });

  it('resolves false when the browser refuses (no user gesture) or the request throws', async () => {
    const element = document.createElement('div');
    stub(document, 'fullscreenEnabled', true);
    stub(element, 'requestFullscreen', () => Promise.reject(new TypeError('Permissions check failed')));
    await expect(toggleFullscreen(element)).resolves.toBe(false);
    stub(element, 'requestFullscreen', () => {
      throw new Error('not allowed');
    });
    await expect(toggleFullscreen(element)).resolves.toBe(false);
  });
});
