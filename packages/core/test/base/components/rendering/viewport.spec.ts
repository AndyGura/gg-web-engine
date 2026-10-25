import { measureViewport, Point2, VIEWPORT_REMEASURE_DELAY, viewportSize$ } from '../../../../src';

/** A stand-in for `window.visualViewport`, which jsdom doesn't have. */
class FakeVisualViewport extends EventTarget {
  constructor(
    public width: number,
    public height: number,
    public scale: number = 1,
  ) {
    super();
  }
}

function setWindowSize(x: number, y: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: x });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: y });
}

function setVisualViewport(vv: FakeVisualViewport | undefined) {
  Object.defineProperty(window, 'visualViewport', { configurable: true, value: vv });
}

describe('viewport measuring', () => {
  const originalWidth = window.innerWidth;
  const originalHeight = window.innerHeight;

  beforeEach(() => {
    jest.useFakeTimers();
    setWindowSize(800, 600);
  });

  afterEach(() => {
    jest.useRealTimers();
    setWindowSize(originalWidth, originalHeight);
    delete (window as any).visualViewport;
  });

  describe('measureViewport', () => {
    it('falls back to innerWidth/innerHeight without a visual viewport', () => {
      expect(window.visualViewport).toBeUndefined();
      expect(measureViewport()).toEqual({ x: 800, y: 600 });
    });

    it('reads the visual viewport where there is one', () => {
      setVisualViewport(new FakeVisualViewport(390, 844));
      expect(measureViewport()).toEqual({ x: 390, y: 844 });
    });

    it('is not shrunk by a pinch zoom', () => {
      setVisualViewport(new FakeVisualViewport(195, 422, 2));
      expect(measureViewport()).toEqual({ x: 390, y: 844 });
    });

    it('falls back to the window while the visual viewport reports an empty size', () => {
      setVisualViewport(new FakeVisualViewport(0, 0));
      expect(measureViewport()).toEqual({ x: 800, y: 600 });
    });
  });

  describe('viewportSize$', () => {
    function collect(): { sizes: Point2[]; stop: () => void } {
      const sizes: Point2[] = [];
      const sub = viewportSize$().subscribe(size => sizes.push(size));
      return { sizes, stop: () => sub.unsubscribe() };
    }

    it('emits the current size on subscription', () => {
      const { sizes, stop } = collect();
      expect(sizes).toEqual([{ x: 800, y: 600 }]);
      stop();
    });

    it('re-measures after a window resize, at most once per 100 ms', () => {
      const { sizes, stop } = collect();
      setWindowSize(1024, 768);
      window.dispatchEvent(new Event('resize'));
      window.dispatchEvent(new Event('resize'));
      expect(sizes).toHaveLength(1);
      jest.advanceTimersByTime(100);
      expect(sizes).toEqual([
        { x: 800, y: 600 },
        { x: 1024, y: 768 },
      ]);
      stop();
    });

    it('re-measures after a visual viewport resize', () => {
      const vv = new FakeVisualViewport(390, 844);
      setVisualViewport(vv);
      const { sizes, stop } = collect();
      vv.height = 500; // an on-screen keyboard opened
      vv.dispatchEvent(new Event('resize'));
      jest.advanceTimersByTime(100);
      expect(sizes).toEqual([
        { x: 390, y: 844 },
        { x: 390, y: 500 },
      ]);
      stop();
    });

    it('measures again a moment after a rotation, for browsers reporting the old size at first', () => {
      const vv = new FakeVisualViewport(390, 844);
      setVisualViewport(vv);
      const { sizes, stop } = collect();
      // the event fires while the browser still reports the size from before the rotation
      window.dispatchEvent(new Event('orientationchange'));
      expect(sizes).toEqual([{ x: 390, y: 844 }]);
      vv.width = 844;
      vv.height = 390;
      jest.advanceTimersByTime(VIEWPORT_REMEASURE_DELAY - 1);
      expect(sizes).toHaveLength(1);
      jest.advanceTimersByTime(1);
      expect(sizes).toEqual([
        { x: 390, y: 844 },
        { x: 844, y: 390 },
      ]);
      stop();
    });

    it('reports a rotation right away when the browser already has the new size', () => {
      const { sizes, stop } = collect();
      setWindowSize(600, 800);
      window.dispatchEvent(new Event('orientationchange'));
      expect(sizes).toEqual([
        { x: 800, y: 600 },
        { x: 600, y: 800 },
      ]);
      // the delayed re-measure finds the same size and emits nothing
      jest.advanceTimersByTime(VIEWPORT_REMEASURE_DELAY);
      expect(sizes).toHaveLength(2);
      stop();
    });

    it('removes its listeners and pending re-measures when unsubscribed', () => {
      const vv = new FakeVisualViewport(390, 844);
      setVisualViewport(vv);
      const addWindow = jest.spyOn(window, 'addEventListener');
      const removeWindow = jest.spyOn(window, 'removeEventListener');
      const addVv = jest.spyOn(vv, 'addEventListener');
      const removeVv = jest.spyOn(vv, 'removeEventListener');
      try {
        const { sizes, stop } = collect();
        window.dispatchEvent(new Event('orientationchange'));
        stop();
        vv.width = 844;
        jest.advanceTimersByTime(VIEWPORT_REMEASURE_DELAY);
        expect(sizes).toHaveLength(1);
        expect(removeWindow.mock.calls.length).toBe(addWindow.mock.calls.length);
        expect(removeVv.mock.calls.length).toBe(addVv.mock.calls.length);
        expect(addVv.mock.calls.map(call => call[0])).toEqual(['resize']);
      } finally {
        addWindow.mockRestore();
        removeWindow.mockRestore();
      }
    });
  });
});
