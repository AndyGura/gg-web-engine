// jsdom has no WebGL: three.js stays real except for WebGLRenderer, replaced by a stand-in that
// keeps the size and pixel ratio the way the real one does.
const renderers: any[] = [];

jest.mock('three', () => {
  const actual = jest.requireActual('three');
  class FakeWebGLRenderer {
    shadowMap: any = {};
    domElement: HTMLCanvasElement;
    pixelRatio = 1;
    width = 0;
    height = 0;
    /** Every `setSize`, as the drawing buffer size it results in */
    bufferSizes: { x: number; y: number }[] = [];
    constructor(params: { canvas?: HTMLCanvasElement }) {
      this.domElement = params.canvas ?? document.createElement('canvas');
      renderers.push(this);
    }
    setClearColor() {}
    setPixelRatio(value: number) {
      this.pixelRatio = value;
      this.setSize(this.width, this.height, false);
    }
    getPixelRatio() {
      return this.pixelRatio;
    }
    setSize(width: number, height: number, _updateStyle?: boolean) {
      this.width = width;
      this.height = height;
      this.bufferSizes.push({ x: Math.floor(width * this.pixelRatio), y: Math.floor(height * this.pixelRatio) });
    }
    getSize(target: any) {
      return target.set(this.width, this.height);
    }
    render() {}
    clear() {}
    dispose() {}
    forceContextLoss() {}
  }
  return { ...actual, WebGLRenderer: FakeWebGLRenderer };
});

import { BehaviorSubject } from 'rxjs';
import { Gg3dWorld, Renderer3dEntity } from '@gg-web-engine/core';
import { ThreeComposerRendererComponent, ThreeRendererComponent, ThreeSceneComponent } from '../../src';

describe('ThreeRendererComponent resolution', () => {
  let scene: ThreeSceneComponent;
  let world: Gg3dWorld;

  beforeEach(async () => {
    renderers.length = 0;
    scene = new ThreeSceneComponent();
    world = new Gg3dWorld({ visualScene: scene });
    await world.init();
  });

  afterEach(() => world.dispose());

  it('starts at a fixed forceResolution', () => {
    world.addRenderer(scene.factory.createPerspectiveCamera(), document.createElement('canvas'), {
      size: { x: 200, y: 100 },
      forceResolution: 1.5,
    });
    expect(renderers[0].pixelRatio).toBe(1.5);
  });

  it('follows an observable forceResolution without recreating the renderer, keeping its size', () => {
    const resolution$ = new BehaviorSubject(2);
    const entity = world.addRenderer(scene.factory.createPerspectiveCamera(), document.createElement('canvas'), {
      size: { x: 200, y: 100 },
      forceResolution: resolution$,
    });
    const native = renderers[0];
    expect(native.pixelRatio).toBe(2);
    expect(native.bufferSizes.at(-1)).toEqual({ x: 400, y: 200 });

    resolution$.next(0.5);
    expect(renderers).toHaveLength(1);
    expect(native.pixelRatio).toBe(0.5);
    expect({ x: native.width, y: native.height }).toEqual({ x: 200, y: 100 });
    expect(native.bufferSizes.at(-1)).toEqual({ x: 100, y: 50 });

    world.removeEntity(entity, true);
    expect(resolution$.observed).toBe(false);
  });

  it('resizes the composer it owns along with the renderer', () => {
    const resolution$ = new BehaviorSubject(1);
    const component = scene.createComposerRenderer(scene.factory.createPerspectiveCamera(), undefined, {
      size: { x: 200, y: 100 },
      forceResolution: resolution$,
    });
    world.addEntity(new Renderer3dEntity(component));
    const composerRatio = jest.spyOn(component.nativeComposer, 'setPixelRatio');

    resolution$.next(2);
    expect(renderers[0].pixelRatio).toBe(2);
    expect(composerRatio).toHaveBeenCalledWith(2);
    expect(component.nativeComposer.renderTarget1.width).toBe(400);
    expect(component.nativeComposer.renderTarget1.height).toBe(200);
  });

  it('applies setResolution directly', () => {
    const component = scene.createRenderer(scene.factory.createPerspectiveCamera());
    expect(component).toBeInstanceOf(ThreeRendererComponent);
    expect(component).not.toBeInstanceOf(ThreeComposerRendererComponent);
    component.setResolution(3);
    expect(component.nativeRenderer.getPixelRatio()).toBe(3);
    component.dispose();
  });
});
