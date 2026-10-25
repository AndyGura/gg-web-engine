import { BehaviorSubject, Subject } from 'rxjs';
import {
  GgWorld,
  IRendererComponent,
  IRendererEntity,
  Point2,
  RendererOptions,
  VIEWPORT_REMEASURE_DELAY,
} from '../../../src';
import { MockWorld } from '../../mocks/world.mock';

class TestRendererEntity extends IRendererEntity<any, any> {}

/** A renderer component recording what the entity asks of it. */
class TestRendererComponent extends IRendererComponent<any, any> {
  camera: any = { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 } };
  physicsDebugViewActive = false;
  readonly sizes: Point2[] = [];
  readonly resolutions: number[] = [];

  constructor(options: Partial<RendererOptions> = {}) {
    super({} as any, undefined, options);
  }

  get startResolution(): number {
    return this.initialResolution;
  }

  setResolution(resolution: number): void {
    this.resolutions.push(resolution);
  }

  resizeRenderer(newSize: Point2): void {
    this.sizes.push(newSize);
  }

  render(): void {}
  addToWorld(): void {}
  removeFromWorld(): void {}
  dispose(): void {}
}

function setWindowSize(x: number, y: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: x });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: y });
}

describe('IRendererEntity', () => {
  let world: GgWorld<any, any>;
  const originalWidth = window.innerWidth;
  const originalHeight = window.innerHeight;
  const originalRatio = window.devicePixelRatio;

  beforeEach(() => {
    jest.useFakeTimers();
    setWindowSize(800, 600);
    world = new MockWorld();
  });

  afterEach(() => {
    world.dispose();
    jest.useRealTimers();
    setWindowSize(originalWidth, originalHeight);
    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: originalRatio });
    delete (window as any).visualViewport;
  });

  describe('forceResolution', () => {
    it('starts at a fixed number', () => {
      expect(new TestRendererComponent({ forceResolution: 1.5 }).startResolution).toBe(1.5);
    });

    it('starts at the device resolution when not set, or when it is an observable', () => {
      Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 3 });
      expect(new TestRendererComponent().startResolution).toBe(3);
      expect(new TestRendererComponent({ forceResolution: new BehaviorSubject(2) }).startResolution).toBe(3);
    });

    it('applies every value an observable emits while the entity is in a world', () => {
      const resolution$ = new BehaviorSubject(2);
      const component = new TestRendererComponent({ size: { x: 100, y: 50 }, forceResolution: resolution$ });
      const renderer = new TestRendererEntity(component);
      world.addEntity(renderer);
      expect(component.resolutions).toEqual([2]);

      resolution$.next(1);
      resolution$.next(1); // a repeat is not applied again
      resolution$.next(0.5);
      expect(component.resolutions).toEqual([2, 1, 0.5]);
      // a resolution change never resizes: the size in CSS pixels stays
      expect(component.sizes).toEqual([{ x: 100, y: 50 }]);
    });

    it('ignores values that are not a usable resolution', () => {
      const resolution$ = new Subject<number>();
      const component = new TestRendererComponent({ size: { x: 100, y: 50 }, forceResolution: resolution$ });
      world.addEntity(new TestRendererEntity(component));
      resolution$.next(0);
      resolution$.next(-1);
      resolution$.next(NaN);
      resolution$.next(Infinity);
      resolution$.next(2);
      expect(component.resolutions).toEqual([2]);
    });

    it('stops following the observable once the entity is removed, and follows it again when re-added', () => {
      const resolution$ = new BehaviorSubject(2);
      const component = new TestRendererComponent({ size: { x: 100, y: 50 }, forceResolution: resolution$ });
      const renderer = new TestRendererEntity(component);
      world.addEntity(renderer);
      world.removeEntity(renderer);
      expect(resolution$.observed).toBe(false);
      resolution$.next(1);
      expect(component.resolutions).toEqual([2]);

      world.addEntity(renderer);
      expect(component.resolutions).toEqual([2, 1]);
      world.removeEntity(renderer, true);
      expect(resolution$.observed).toBe(false);
    });

    it('subscribes to nothing for a fixed number', () => {
      const component = new TestRendererComponent({ size: { x: 100, y: 50 }, forceResolution: 2 });
      world.addEntity(new TestRendererEntity(component));
      expect(component.resolutions).toEqual([]);
    });
  });

  describe("'fullscreen' size", () => {
    it('measures the page through the visual viewport and again after a rotation', () => {
      const vv: any = Object.assign(new EventTarget(), { width: 390, height: 844, scale: 1 });
      Object.defineProperty(window, 'visualViewport', { configurable: true, value: vv });
      const component = new TestRendererComponent({ size: 'fullscreen' });
      const renderer = new TestRendererEntity(component);
      world.addEntity(renderer);
      expect(component.sizes).toEqual([{ x: 390, y: 844 }]);

      // the event comes while the old size is still reported, the new one settles a moment later
      window.dispatchEvent(new Event('orientationchange'));
      vv.width = 844;
      vv.height = 390;
      jest.advanceTimersByTime(VIEWPORT_REMEASURE_DELAY);
      expect(component.sizes).toEqual([
        { x: 390, y: 844 },
        { x: 844, y: 390 },
      ]);
      expect(renderer.rendererSize).toEqual({ x: 844, y: 390 });

      world.removeEntity(renderer);
      vv.width = 500;
      vv.dispatchEvent(new Event('resize'));
      jest.advanceTimersByTime(VIEWPORT_REMEASURE_DELAY);
      expect(component.sizes).toHaveLength(2);
    });

    it('falls back to the window size without a visual viewport', () => {
      const component = new TestRendererComponent({ size: 'fullscreen' });
      world.addEntity(new TestRendererEntity(component));
      setWindowSize(1024, 768);
      window.dispatchEvent(new Event('resize'));
      jest.advanceTimersByTime(100);
      expect(component.sizes).toEqual([
        { x: 800, y: 600 },
        { x: 1024, y: 768 },
      ]);
    });

    it('maps the same measurement through a size function', () => {
      const component = new TestRendererComponent({ size: page => ({ x: page.x / 2, y: page.y / 2 }) });
      world.addEntity(new TestRendererEntity(component));
      expect(component.sizes).toEqual([{ x: 400, y: 300 }]);
    });
  });
});
