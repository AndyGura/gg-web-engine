// Replaces pixi.js with an Application stand-in whose async init is resolved by the test - this
// package's jest setup can't load the real pixi.js runtime (see pixi-display-object.component.spec.ts).
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
    renderer = { resize: jest.fn() };
    render = jest.fn();
    constructor() {
      pixi.applications.push(this);
    }
    init() {
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

  it('destroys the application right away once initialized, and only once', async () => {
    const renderer = new PixiRendererComponent(scene, {} as any);
    const app = pixi.applications[0];
    pixi.resolveInit();
    await flush();
    renderer.dispose();
    renderer.dispose();
    expect(app.destroy).toHaveBeenCalledTimes(1);
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
});
