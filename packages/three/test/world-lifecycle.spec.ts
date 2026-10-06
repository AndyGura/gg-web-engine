// jsdom has no WebGL: three.js stays real except for WebGLRenderer, replaced by a stand-in that
// records whether its GPU resources and context were given back.
const renderers: any[] = [];

jest.mock('three', () => {
  const actual = jest.requireActual('three');
  class FakeWebGLRenderer {
    shadowMap: any = {};
    domElement: any;
    disposed = false;
    contextLost = false;
    constructor(params: { canvas?: HTMLCanvasElement }) {
      this.domElement = params.canvas ?? document.createElement('canvas');
      renderers.push(this);
    }
    setClearColor() {}
    setPixelRatio() {}
    setSize() {}
    render() {}
    clear() {}
    dispose() {
      this.disposed = true;
    }
    forceContextLoss() {
      this.contextLost = true;
    }
  }
  return { ...actual, WebGLRenderer: FakeWebGLRenderer };
});

import { Gg3dWorld, GgWorld } from '@gg-web-engine/core';
import { ThreeSceneComponent } from '../src';

describe('a three world created and disposed many times', () => {
  it('gives back every renderer, its WebGL context and every listener it added', async () => {
    const worldsBefore = GgWorld.documentWorlds.length;
    const listeners = new Map<string, number>();
    const count = (delta: number) => (type: string) => listeners.set(type, (listeners.get(type) ?? 0) + delta);
    const targets = [window, document];
    const spies = targets.flatMap(target => [
      jest.spyOn(target, 'addEventListener').mockImplementation(function (this: any, type: string) {
        count(1)(type);
      } as any),
      jest.spyOn(target, 'removeEventListener').mockImplementation(function (this: any, type: string) {
        count(-1)(type);
      } as any),
    ]);

    try {
      for (let i = 0; i < 30; i++) {
        const scene = new ThreeSceneComponent();
        const world = new Gg3dWorld({ visualScene: scene });
        await world.init();
        const camera = scene.factory.createPerspectiveCamera();
        world.addRenderer(camera, document.createElement('canvas'));
        world.start();
        world.dispose();
        expect(scene.renderers.size).toBe(0);
      }
    } finally {
      spies.forEach(spy => spy.mockRestore());
    }

    expect(renderers).toHaveLength(30);
    expect(renderers.every(r => r.disposed && r.contextLost)).toBe(true);
    expect(GgWorld.documentWorlds.length).toBe(worldsBefore);
    // the worlds did add listeners (keyboard, console, visibility), and took every one back
    expect(listeners.size).toBeGreaterThan(0);
    for (const [type, balance] of listeners) {
      expect([type, balance]).toEqual([type, 0]);
    }
  });
});
