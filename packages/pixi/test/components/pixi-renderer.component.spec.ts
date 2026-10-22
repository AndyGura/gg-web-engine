// Replaces pixi.js with an Application stand-in whose async init is resolved by the test, so the
// test controls when initialization finishes.
const pixi = {
  resolveInit: () => {},
  pendingInits: [] as (() => void)[],
  applications: [] as any[],
};

jest.mock('pixi.js', () => {
  class Application {
    initialized = false;
    destroyed = false;
    stage = { addChild: jest.fn(), removeChild: jest.fn() };
    ticker = { stop: jest.fn(), destroy: jest.fn() };
    options: any = null;
    // pixi's renderer.resize keeps the resolution when none is given
    renderer = {
      width: 0,
      height: 0,
      resolution: 1,
      resize: jest.fn(function (this: any, width: number, height: number, resolution?: number) {
        this.width = width;
        this.height = height;
        this.resolution = resolution ?? this.resolution;
      }),
    };
    render = jest.fn();
    constructor() {
      pixi.applications.push(this);
    }
    init(options: any) {
      this.options = options;
      this.renderer.resolution = options.resolution;
      return new Promise<void>(resolve => {
        const finish = () => {
          this.initialized = true;
          resolve();
        };
        pixi.resolveInit = finish;
        pixi.pendingInits.push(finish);
      });
    }
    destroy = jest.fn(() => {
      // pixi 8: the resize plugin's destroy calls a function its init sets up
      if (!this.initialized) {
        throw new TypeError('this._cancelResize is not a function');
      }
      this.destroyed = true;
    });
  }
  class Empty {}
  return { Application, Container: Empty, Graphics: Empty, Sprite: Empty, Texture: Empty };
});

import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { PixiRendererComponent } from '../../src/components/pixi-renderer.component';

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

describe('PixiRendererComponent', () => {
  const scene: any = { renderers: new Set(), nativeContainer: {}, parallaxLayers: [], environment: {} };

  beforeEach(() => {
    pixi.applications = [];
    pixi.pendingInits = [];
  });

  it('can be disposed before pixi finished initializing, and frees the application once it has', async () => {
    const renderer = new PixiRendererComponent(scene, {} as any);
    const app = pixi.applications[0];
    renderer.render();
    expect(() => renderer.dispose()).not.toThrow();
    expect(app.destroy).not.toHaveBeenCalled();

    pixi.resolveInit();
    await flush();
    expect(app.destroyed).toBe(true);
    // the render requested before init never runs against the destroyed application
    expect(app.render).not.toHaveBeenCalled();
    expect(renderer.nativeTextureSystem).toBeNull();
  });

  it('reports the end of pixi init through initialized$, also to a subscriber that comes later', async () => {
    const renderer = new PixiRendererComponent(scene, {} as any);
    const early = jest.fn();
    renderer.initialized$.subscribe(early);
    expect(renderer.initialized).toBe(false);
    pixi.resolveInit();
    await flush();
    expect(renderer.initialized).toBe(true);
    expect(early).toHaveBeenCalledTimes(1);
    await expect(firstValueFrom(renderer.initialized$)).resolves.toBeUndefined();
    renderer.dispose();
  });

  it('completes initialized$ without emitting when disposed before init finished', async () => {
    const renderer = new PixiRendererComponent(scene, {} as any);
    const next = jest.fn();
    const complete = jest.fn();
    renderer.initialized$.subscribe({ next, complete });
    renderer.dispose();
    pixi.resolveInit();
    await flush();
    expect(next).not.toHaveBeenCalled();
    expect(complete).toHaveBeenCalledTimes(1);
    expect(renderer.initialized).toBe(false);
  });

  it('destroys the application right away once initialized, and only once', async () => {
    const renderer = new PixiRendererComponent(scene, {} as any);
    const app = pixi.applications[0];
    pixi.resolveInit();
    await flush();
    renderer.dispose();
    renderer.dispose();
    expect(app.destroy).toHaveBeenCalledTimes(1);
  });

  it('keeps a canvas the app passed in the page, and lets pixi remove only one of its own', async () => {
    const canvas = document.createElement('canvas');
    const withCanvas = new PixiRendererComponent(scene, {} as any, canvas);
    const withoutCanvas = new PixiRendererComponent(scene, {} as any);
    pixi.pendingInits.splice(0).forEach(finish => finish());
    await flush();
    withCanvas.dispose();
    withoutCanvas.dispose();
    expect(pixi.applications[0].destroy).toHaveBeenCalledWith({ removeView: false }, true);
    expect(pixi.applications[1].destroy).toHaveBeenCalledWith({ removeView: true }, true);
  });

  it('frees every application over many create/dispose rounds, disposed before or after init', async () => {
    for (let i = 0; i < 30; i++) {
      const renderer = new PixiRendererComponent(scene, {} as any);
      if (i % 2) {
        pixi.pendingInits.splice(0).forEach(finish => finish());
        await flush();
      }
      renderer.dispose();
    }
    pixi.pendingInits.splice(0).forEach(finish => finish());
    await flush();
    expect(pixi.applications).toHaveLength(30);
    expect(pixi.applications.every(app => app.destroyed)).toBe(true);
    expect(pixi.applications.every(app => app.destroy.mock.calls.length === 1)).toBe(true);
    expect(scene.renderers.size).toBe(0);
  });

  describe('resolution', () => {
    const originalRatio = window.devicePixelRatio;
    afterEach(() => {
      Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: originalRatio });
    });

    it('starts at a fixed forceResolution, keeping the canvas CSS size', () => {
      const renderer = new PixiRendererComponent(scene, {} as any, undefined, { forceResolution: 1.5 });
      const app = pixi.applications[0];
      expect(app.options.resolution).toBe(1.5);
      expect(app.options.autoDensity).toBe(true);
      renderer.dispose();
    });

    it('starts at the device resolution for an observable forceResolution, until it emits', () => {
      Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 3 });
      const renderer = new PixiRendererComponent(scene, {} as any, undefined, {
        forceResolution: new BehaviorSubject(2),
      });
      expect(pixi.applications[0].options.resolution).toBe(3);
      renderer.dispose();
    });

    it('changes the resolution in place, keeping the size', async () => {
      const renderer = new PixiRendererComponent(scene, {} as any);
      const app = pixi.applications[0];
      pixi.resolveInit();
      await flush();
      renderer.resizeRenderer({ x: 200, y: 100 });
      renderer.setResolution(0.5);
      expect(pixi.applications).toHaveLength(1);
      expect(app.renderer.resize).toHaveBeenLastCalledWith(200, 100, 0.5);
      expect(app.renderer.resolution).toBe(0.5);
      renderer.dispose();
    });

    it('applies a resolution set before init once pixi has initialized', async () => {
      const renderer = new PixiRendererComponent(scene, {} as any);
      const app = pixi.applications[0];
      renderer.resizeRenderer({ x: 200, y: 100 });
      renderer.setResolution(2);
      expect(app.renderer.resize).not.toHaveBeenCalled();
      pixi.resolveInit();
      await flush();
      expect(app.renderer.resize.mock.calls).toEqual([
        [200, 100],
        [200, 100, 2],
      ]);
      renderer.dispose();
    });

    it('drops a pending resolution change when disposed before init', async () => {
      const renderer = new PixiRendererComponent(scene, {} as any);
      const app = pixi.applications[0];
      renderer.setResolution(2);
      renderer.dispose();
      pixi.resolveInit();
      await flush();
      expect(app.renderer.resize).not.toHaveBeenCalled();
    });
  });
});
