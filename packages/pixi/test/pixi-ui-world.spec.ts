// A UI layer drawn over another canvas: a physics-less Gg2dWorld with the real pixi scene, a
// transparent renderer whose camera origin is the top-left corner, and raw pixi display objects
// added to the scene's native container. Only pixi's Application is replaced (jsdom has no WebGL);
// containers, transforms and the world are the real ones.
const apps: any[] = [];

jest.mock('pixi.js', () => {
  const actual = jest.requireActual('pixi.js');
  class Application {
    options: any = null;
    stage = new actual.Container();
    ticker = { stop: jest.fn(), destroy: jest.fn() };
    renderer = {
      width: 0,
      height: 0,
      resize: jest.fn((width: number, height: number) => {
        this.renderer.width = width;
        this.renderer.height = height;
      }),
      background: { color: { toNumber: () => 0 }, alpha: 1 },
    };
    render = jest.fn();
    destroy = jest.fn();
    constructor() {
      apps.push(this);
    }
    async init(options: any) {
      this.options = options;
    }
  }
  return { ...actual, Application };
});

import { Container, Point } from 'pixi.js';
import { firstValueFrom } from 'rxjs';
import { Entity2d, Gg2dWorld, Pnt2, Point2 } from '@gg-web-engine/core';
import { PixiGgWorld, PixiSceneComponent } from '../src';

describe('a physics-less 2D world as a UI layer', () => {
  let world: PixiGgWorld;
  let canvas: HTMLCanvasElement;

  const screenPointOf = (object: Container): Point2 => {
    const p = object.toGlobal(new Point(0, 0));
    return { x: p.x, y: p.y };
  };
  const frame = () => world.worldClock.step(16);

  beforeEach(async () => {
    apps.length = 0;
    canvas = document.body.appendChild(document.createElement('canvas'));
    world = new Gg2dWorld({ visualScene: new PixiSceneComponent() });
    await world.init();
    world.start();
    world.pauseWorld(); // driven frame by frame below
  });

  afterEach(() => {
    world.dispose();
    canvas.remove();
  });

  it('draws raw pixi objects at their own pixel coordinates, with a transparent background', async () => {
    expect(world.physicsWorld).toBeNull();
    const camera = world.visualScene.factory.createCamera();
    camera.origin = 'top-left';
    const renderer = world.addRenderer(camera, canvas, { transparent: true, size: { x: 800, y: 600 } });
    await firstValueFrom(renderer.renderer.initialized$);
    const app = apps[0];
    expect(app.options.backgroundAlpha).toBe(0);

    const ui = new Container();
    const button = ui.addChild(new Container());
    button.position.set(10, 20);
    world.visualScene.nativeContainer!.addChild(ui);
    // an engine display object, without a body, next to the raw ones
    const badgeObject = world.visualScene.factory.createBox({ x: 40, y: 40 });
    const badge = new Entity2d({ object2D: badgeObject });
    world.addEntity(badge);
    badge.position = { x: 700, y: 550 };

    frame();
    expect(app.renderer.resize).toHaveBeenCalledWith(800, 600);
    expect(app.render).toHaveBeenCalled();
    expect(app.renderer.background.alpha).toBe(1); // never touched: no environment color
    expect(screenPointOf(button)).toEqual({ x: 10, y: 20 });
    expect(screenPointOf(badgeObject.nativeSprite)).toEqual({ x: 700, y: 550 });

    // the camera position is the view's top-left corner, and the view zooms around it
    renderer.position = { x: 5, y: 10 };
    camera.zoom = 2;
    frame();
    expect(screenPointOf(button)).toEqual({ x: 10, y: 20 });
  });

  it('keeps the view centered on the camera position by default', async () => {
    const camera = world.visualScene.factory.createCamera();
    expect(camera.origin).toBe('center');
    const renderer = world.addRenderer(camera, canvas, { transparent: true, size: { x: 800, y: 600 } });
    await firstValueFrom(renderer.renderer.initialized$);
    const marker = world.visualScene.nativeContainer!.addChild(new Container());

    frame();
    expect(screenPointOf(marker)).toEqual({ x: 400, y: 300 });

    // switching the origin takes effect on the next frame
    camera.origin = 'top-left';
    frame();
    expect(screenPointOf(marker)).toEqual(Pnt2.O);
  });

  it('frees the renderer with the world', async () => {
    const renderer = world.addRenderer(world.visualScene.factory.createCamera(), canvas, { transparent: true });
    await firstValueFrom(renderer.renderer.initialized$);
    world.dispose();
    expect(apps[0].destroy).toHaveBeenCalledTimes(1);
    world = new Gg2dWorld({ visualScene: new PixiSceneComponent() }); // for afterEach
  });
});
