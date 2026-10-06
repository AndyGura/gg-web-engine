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

describe('MouseInput touch movement', () => {
  // jsdom has no PointerEvent; MouseInput tells pointer events apart from mouse events by `instanceof`
  const PointerEventPolyfill = class PointerEvent extends MouseEvent {};
  beforeAll(() => ((globalThis as any).PointerEvent = PointerEventPolyfill));
  afterAll(() => delete (globalThis as any).PointerEvent);

  const pointerEvent = (
    type: string,
    init: { x: number; y: number; pointerId?: number; pointerType?: string; isPrimary?: boolean; movementX?: number },
  ) => {
    const event = new MouseEvent(type, { bubbles: true, clientX: init.x, clientY: init.y });
    Object.defineProperty(event, 'pointerId', { value: init.pointerId ?? 1 });
    Object.defineProperty(event, 'pointerType', { value: init.pointerType ?? 'touch' });
    Object.defineProperty(event, 'isPrimary', { value: init.isPrimary ?? true });
    Object.defineProperty(event, 'movementX', { value: init.movementX ?? 0 });
    Object.defineProperty(event, 'movementY', { value: 0 });
    Object.setPrototypeOf(event, PointerEventPolyfill.prototype);
    return event;
  };

  let canvas: HTMLCanvasElement;
  let input: MouseInput;
  let deltas: { x: number; y: number }[];

  beforeEach(() => {
    canvas = document.createElement('canvas');
    document.body.appendChild(canvas);
    deltas = [];
  });

  afterEach(() => {
    input.stop(false); // jsdom has no document.exitPointerLock
    canvas.remove();
  });

  const start = (options: Partial<ConstructorParameters<typeof MouseInput>[0]> = {}) => {
    input = new MouseInput({ canvas, ...options });
    input.delta$.subscribe(d => deltas.push(d));
    input.start();
  };

  it('measures a finger from its own previous position, times touchSensitivity, not movementX', () => {
    start();
    canvas.dispatchEvent(pointerEvent('pointerdown', { x: 100, y: 100 }));
    canvas.dispatchEvent(pointerEvent('pointermove', { x: 110, y: 95, movementX: 1 }));
    canvas.dispatchEvent(pointerEvent('pointermove', { x: 130, y: 95, movementX: 1 }));
    expect(deltas).toEqual([
      { x: 30, y: -15 },
      { x: 60, y: 0 },
    ]);
  });

  it('applies the configured touchSensitivity', () => {
    start({ touchSensitivity: 1 });
    canvas.dispatchEvent(pointerEvent('pointerdown', { x: 0, y: 0 }));
    canvas.dispatchEvent(pointerEvent('pointermove', { x: 4, y: 2 }));
    expect(deltas).toEqual([{ x: 4, y: 2 }]);
  });

  it('reports no movement for a finger it has not seen before, and none for a second finger', () => {
    start({ touchSensitivity: 1 });
    canvas.dispatchEvent(pointerEvent('pointermove', { x: 50, y: 50 }));
    expect(deltas).toEqual([]);
    canvas.dispatchEvent(pointerEvent('pointermove', { x: 60, y: 50 }));
    expect(deltas).toEqual([{ x: 10, y: 0 }]);

    canvas.dispatchEvent(pointerEvent('pointerdown', { x: 200, y: 200, pointerId: 2, isPrimary: false }));
    canvas.dispatchEvent(pointerEvent('pointermove', { x: 230, y: 200, pointerId: 2, isPrimary: false }));
    expect(deltas).toEqual([{ x: 10, y: 0 }]);
  });

  it('keeps using movementX/movementY for a mouse pointer', () => {
    start();
    canvas.dispatchEvent(pointerEvent('pointermove', { x: 10, y: 10, pointerType: 'mouse', movementX: 7 }));
    expect(deltas).toEqual([{ x: 7, y: 0 }]);
  });
});
