// A UI layer drawn over another canvas: a physics-less Gg2dWorld with the real pixi scene at one
// pixel per meter, a transparent renderer whose camera origin is the top-left corner, and raw pixi
// display objects added to the scene's native container. Only pixi's Application is replaced (jsdom
// has no WebGL); containers, transforms and the world are the real ones. The last cases check the
// scene's pixels-per-meter mapping at the default density.
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

import { BufferImageSource, Container, Point, Texture } from 'pixi.js';
import { firstValueFrom } from 'rxjs';
import { Entity2d, Gg2dWorld, Pnt2, Point2 } from '@gg-web-engine/core';
import { PixiGgWorld, PixiSceneComponent } from '../src';

const screenPointOf = (object: Container): Point2 => {
  const p = object.toGlobal(new Point(0, 0));
  return { x: p.x, y: p.y };
};

describe('a physics-less 2D world as a UI layer', () => {
  let world: PixiGgWorld;
  let canvas: HTMLCanvasElement;

  const frame = () => world.worldClock.step(16);

  beforeEach(async () => {
    apps.length = 0;
    canvas = document.body.appendChild(document.createElement('canvas'));
    world = new Gg2dWorld({ visualScene: new PixiSceneComponent({ pixelsPerMeter: 1 }) });
    await world.init();
    world.start();
    world.pauseWorld(); // driven frame by frame below
  });

  afterEach(() => {
    world.dispose();
    canvas.remove();
  });

  it('lays the world out in canvas pixels at one pixel per meter', () => {
    expect(world.visualScene.pixelsPerMeter).toBe(1);
    expect(world.visualScene.factory.pixelsPerMeter).toBe(1);
    expect(world.visualScene.factory.createCamera().pixelsPerMeter).toBe(1);
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
    world = new Gg2dWorld({ visualScene: new PixiSceneComponent({ pixelsPerMeter: 1 }) }); // for afterEach
  });
});

describe('the scene maps meters to screen pixels through pixelsPerMeter and the camera zoom', () => {
  let world: PixiGgWorld;
  let canvas: HTMLCanvasElement;

  const frame = () => world.worldClock.step(16);

  beforeEach(async () => {
    apps.length = 0;
    canvas = document.body.appendChild(document.createElement('canvas'));
    world = new Gg2dWorld({ visualScene: new PixiSceneComponent() });
    await world.init();
    world.start();
    world.pauseWorld();
  });

  afterEach(() => {
    world.dispose();
    canvas.remove();
  });

  it('defaults to 100 pixels per meter and rejects a non-positive density', () => {
    expect(world.visualScene.pixelsPerMeter).toBe(100);
    expect(new PixiSceneComponent({ pixelsPerMeter: 32 }).pixelsPerMeter).toBe(32);
    expect(() => new PixiSceneComponent({ pixelsPerMeter: 0 })).toThrow();
    expect(() => new PixiSceneComponent({ pixelsPerMeter: -1 })).toThrow();
  });

  it('draws a meter as pixelsPerMeter screen pixels at zoom 1, and zoom multiplies that', async () => {
    const camera = world.visualScene.factory.createCamera();
    camera.origin = 'top-left';
    const renderer = world.addRenderer(camera, canvas, { size: { x: 800, y: 600 } });
    await firstValueFrom(renderer.renderer.initialized$);

    const marker = world.visualScene.nativeContainer!.addChild(new Container());
    marker.position.set(1, 2); // meters
    const box = world.visualScene.factory.createBox({ x: 0.5, y: 0.25 });
    world.addEntity(new Entity2d({ object2D: box }));
    box.position = { x: 3, y: 0 };

    frame();
    expect(screenPointOf(marker)).toEqual({ x: 100, y: 200 });
    expect(screenPointOf(box.nativeSprite)).toEqual({ x: 300, y: 0 });
    // the box's screen size: 0.5x0.25 m is 50x25 px
    const bounds = box.nativeSprite.getBounds(); // in the stage's (screen) coordinates
    expect(bounds.width).toBeCloseTo(50);
    expect(bounds.height).toBeCloseTo(25);
    // and the same from the camera's own mapping
    expect(camera.worldToScreen({ x: 1, y: 2 })).toEqual({ x: 100, y: 200 });
    expect(camera.screenToWorld({ x: 100, y: 200 })).toEqual({ x: 1, y: 2 });

    camera.zoom = 2;
    frame();
    expect(screenPointOf(marker)).toEqual({ x: 200, y: 400 });
    expect(box.nativeSprite.getBounds().width).toBeCloseTo(100);
    expect(camera.worldToScreen({ x: 1, y: 2 })).toEqual({ x: 200, y: 400 });
  });

  it('sizes a texture by its texels over pixelsPerMeter and text by its font size in pixels', () => {
    const factory = world.visualScene.factory;
    const texture = new Texture({
      source: new BufferImageSource({ resource: new Uint8Array(48 * 72 * 4), width: 48, height: 72 }),
    });
    const sprite = factory.createAnimatedSprite(texture, {
      frameWidth: 48,
      frameHeight: 72,
      clips: { idle: { row: 0, frameCount: 1 } },
    });
    expect(sprite.scale).toEqual({ x: 1, y: 1 });
    const { min, max } = sprite.getLocalBoundings();
    expect(max.x - min.x).toBeCloseTo(0.48);
    expect(max.y - min.y).toBeCloseTo(0.72);
    sprite.scale = { x: 2, y: 2 };
    const copy = sprite.clone();
    expect(copy.scale).toEqual({ x: 2, y: 2 });
    expect(copy.getLocalBoundings().max.x - copy.getLocalBoundings().min.x).toBeCloseTo(0.48);

    const text = factory.createText('x', { fontSize: 20 });
    expect(text.scale).toEqual({ x: 1, y: 1 });
    expect(text.nativeSprite.scale.x).toBeCloseTo(0.01);
    expect(text.clone().scale).toEqual({ x: 1, y: 1 });
  });
});
