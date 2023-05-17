import { BehaviorSubject } from 'rxjs';
import { BaseGgRenderer, Point2, RendererOptions } from '../../../src';
import { GgWorld } from '../../../src/base/gg-world';
import { MockWorld } from '../../mocks/world.mock';

class TestRenderer extends BaseGgRenderer {
  public _rendererSize$: BehaviorSubject<Point2 | null> = new BehaviorSubject<Point2 | null>(null);

  constructor(public readonly canvas?: HTMLCanvasElement, options: Partial<RendererOptions> = {}) {
    super(canvas, options);
  }

  public resizeRenderer(newSize: Point2): void {
  }

  render(): void {
  }
}

describe('BaseGgRenderer', () => {
  let renderer: TestRenderer;
  let world: GgWorld<any, any>;

  beforeEach(() => {
    // Create a mock HTMLCanvasElement
    const canvas = document.createElement('canvas');
    const options: RendererOptions = {
      transparent: true,
      background: 0xffffff,
      size: { x: 800, y: 600 },
      antialias: false,
    };

    renderer = new TestRenderer(canvas, options);
    world = new MockWorld();
    world.addEntity(renderer);
  });

  afterEach(() => {
    renderer.dispose();
    world.dispose();
  });

  it('should initialize with the provided options', () => {
    expect(renderer.rendererOptions.transparent).toBe(true);
    expect(renderer.rendererOptions.background).toBe(0xffffff);
    expect(renderer.rendererOptions.size).toEqual({ x: 800, y: 600 });
    expect(renderer.rendererOptions.antialias).toBe(false);
  });

  it('should render the scene when tick event is emitted', () => {
    const renderSpy = jest.spyOn(renderer, 'render');
    renderer.tick$.next([0, 0]);
    expect(renderSpy).toHaveBeenCalledTimes(1);
  });

  it('should resize the renderer when a new size is provided', () => {
    const resizeRendererSpy = jest.spyOn(renderer, 'resizeRenderer');
    const newSize = { x: 1024, y: 768 };
    renderer._rendererSize$.next(newSize);
    expect(resizeRendererSpy).toHaveBeenCalledWith(newSize);
  });

  it('should update the rendererSize$ observable when the size changes', () => {
    const newSize = { x: 1024, y: 768 };
    const size$ = new BehaviorSubject<Point2 | null>(null);
    renderer._rendererSize$ = size$;

    let emittedSize: Point2 | null = null;
    renderer.rendererSize$.subscribe(size => {
      emittedSize = size;
    });

    size$.next(newSize);
    expect(emittedSize).toEqual(newSize);
  });

  it('should set the canvas position to absolute when size is fullscreen or a function', () => {
    const canvas = document.createElement('canvas');
    const options: RendererOptions = {
      transparent: true,
      background: 0xffffff,
      size: 'fullscreen',
      antialias: false,
    };

    const renderer = new TestRenderer(canvas, options);
    world.addEntity(renderer);
    expect(renderer.canvas!.style.position).toBe('absolute');
  });

  it('should unsubscribe from observables and complete subject on dispose', () => {
    renderer.dispose();
    expect(renderer._rendererSize$.isStopped).toBe(true);
  });

  it('should call resizeRenderer when rendererSize changes', () => {
    const resizeRendererSpy = jest.spyOn(renderer, 'resizeRenderer');
    const newSize = { x: 1024, y: 768 };
    renderer._rendererSize$.next(newSize);
    expect(resizeRendererSpy).toHaveBeenCalledWith(newSize);
  });

  it('should handle different cases for rendererOptions.size', () => {
    const newSize = { x: 1024, y: 768 };
    const sizeObservable$ = new BehaviorSubject<Point2>(newSize);
    const options: RendererOptions = {
      transparent: true,
      background: 0xffffff,
      size: sizeObservable$,
      antialias: false,
    };

    const renderer = new TestRenderer(undefined, options);
    world.addEntity(renderer);

    // Test for Observable case
    sizeObservable$.next({ x: 800, y: 600 });
    expect(renderer.rendererSize).toEqual({ x: 800, y: 600 });

    // Test for simple case
    const optionsWithSizeValue: RendererOptions = {
      transparent: true,
      background: 0xffffff,
      size: newSize,
      antialias: false,
    };

    const rendererWithSizeValue = new TestRenderer(undefined, optionsWithSizeValue);
    world.addEntity(rendererWithSizeValue);
    expect(rendererWithSizeValue.rendererSize).toEqual(newSize);
  });

  it('should update the rendererSize$ observable when the size changes', () => {
    const newSize = { x: 1024, y: 768 };
    const size$ = new BehaviorSubject<Point2 | null>(null);
    renderer._rendererSize$ = size$;

    let emittedSize: Point2 | null = null;
    renderer.rendererSize$.subscribe(size => {
      emittedSize = size;
    });

    size$.next(newSize);
    expect(emittedSize).toEqual(newSize);
  });

  it('should handle different cases for rendererOptions.size', () => {
    const newSize = { x: 1024, y: 768 };
    const sizeObservable$ = new BehaviorSubject<Point2>(newSize);
    const options: RendererOptions = {
      transparent: true,
      background: 0xffffff,
      size: sizeObservable$,
      antialias: false,
    };

    const renderer = new TestRenderer(undefined, options);
    world.addEntity(renderer);

    // Test for Observable case
    sizeObservable$.next({ x: 800, y: 600 });
    expect(renderer.rendererSize).toEqual({ x: 800, y: 600 });

    // Test for simple case
    const optionsWithSizeValue: RendererOptions = {
      transparent: true,
      background: 0xffffff,
      size: newSize,
      antialias: false,
    };

    const rendererWithSizeValue = new TestRenderer(undefined, optionsWithSizeValue);
    world.addEntity(rendererWithSizeValue);
    expect(rendererWithSizeValue.rendererSize).toEqual(newSize);
  });
});
