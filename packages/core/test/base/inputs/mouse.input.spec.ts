import { MouseInput } from '../../../src';

describe('MouseInput.isTouchDevice', () => {
  const setNavigator = (userAgent: string, maxTouchPoints: number) => {
    Object.defineProperty(navigator, 'userAgent', { value: userAgent, configurable: true });
    Object.defineProperty(navigator, 'maxTouchPoints', { value: maxTouchPoints, configurable: true });
  };
  const originalUserAgent = navigator.userAgent;
  const originalMaxTouchPoints = navigator.maxTouchPoints;

  afterEach(() => {
    setNavigator(originalUserAgent, originalMaxTouchPoints);
    delete (window as any).matchMedia;
  });

  it('is false for a desktop with a mouse', () => {
    setNavigator('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15', 0);
    expect(MouseInput.isTouchDevice()).toBe(false);
  });

  it('is true for a phone', () => {
    setNavigator('Mozilla/5.0 (Linux; Android 14) Chrome/120.0 Mobile', 5);
    expect(MouseInput.isTouchDevice()).toBe(true);
  });

  it('is true for an iPad introducing itself as a desktop Mac', () => {
    setNavigator('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15', 5);
    expect(MouseInput.isTouchDevice()).toBe(true);
  });

  it('is true wherever the primary pointer is coarse', () => {
    setNavigator('Mozilla/5.0 (X11; Linux x86_64) Chrome/120.0', 0);
    (window as any).matchMedia = (query: string) => ({ matches: query === '(pointer: coarse)' });
    expect(MouseInput.isTouchDevice()).toBe(true);
  });
});
