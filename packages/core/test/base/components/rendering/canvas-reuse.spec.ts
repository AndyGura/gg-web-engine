import { Gg2dWorld, Gg3dWorld, replaceCanvas } from '../../../../src';

const fakeRenderer = (canvas?: HTMLCanvasElement): any => ({
  camera: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 } },
  rendererOptions: { transparent: false, background: 0, size: { x: 100, y: 100 }, antialias: true },
  canvas,
  physicsDebugViewActive: false,
  render: () => {},
  addToWorld: () => {},
  removeFromWorld: () => {},
  resizeRenderer: () => {},
  dispose: jest.fn(),
  entity: null,
});

const visualScene = () => ({
  init: async () => {},
  dispose: () => {},
  createRenderer: jest.fn((_camera: any, canvas?: HTMLCanvasElement) => fakeRenderer(canvas)),
});

describe('replaceCanvas', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('puts a blank copy with the same id, classes, attributes and style where the canvas was', () => {
    const holder = document.createElement('div');
    const before = document.createElement('span');
    const canvas = document.createElement('canvas');
    canvas.id = 'gg';
    canvas.className = 'game wide';
    canvas.width = 640;
    canvas.setAttribute('data-role', 'view');
    canvas.style.position = 'absolute';
    const after = document.createElement('span');
    holder.append(before, canvas, after);
    document.body.appendChild(holder);
    const listener = jest.fn();
    canvas.addEventListener('click', listener);

    const fresh = replaceCanvas(canvas);

    expect(fresh).not.toBe(canvas);
    expect(fresh).toBeInstanceOf(HTMLCanvasElement);
    expect(Array.from(holder.children)).toEqual([before, fresh, after]);
    expect(canvas.isConnected).toBe(false);
    expect(document.getElementById('gg')).toBe(fresh);
    expect(fresh.className).toBe('game wide');
    expect(fresh.width).toBe(640);
    expect(fresh.getAttribute('data-role')).toBe('view');
    expect(fresh.style.position).toBe('absolute');
    fresh.dispatchEvent(new MouseEvent('click'));
    expect(listener).not.toHaveBeenCalled();
  });

  it('copies a canvas that is not in the page, leaving the copy out of it too', () => {
    const canvas = document.createElement('canvas');
    const fresh = replaceCanvas(canvas);
    expect(fresh).not.toBe(canvas);
    expect(fresh.isConnected).toBe(false);
  });
});

describe('a canvas whose renderer was disposed', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it.each([
    ['Gg3dWorld', () => new Gg3dWorld({ visualScene: visualScene() } as any) as any],
    ['Gg2dWorld', () => new Gg2dWorld({ visualScene: visualScene() } as any) as any],
  ])('%s refuses it for a new renderer, naming replaceCanvas, and takes the replacement', (_, createWorld) => {
    const canvas = document.createElement('canvas');
    document.body.appendChild(canvas);
    const first = createWorld();
    first.addRenderer({}, canvas);
    first.dispose();

    const second = createWorld();
    expect(() => second.addRenderer({}, canvas)).toThrow(/replaceCanvas/);
    expect(second.visualScene.createRenderer).not.toHaveBeenCalled();
    const fresh = replaceCanvas(canvas);
    expect(() => second.addRenderer({}, fresh)).not.toThrow();
    second.dispose();
  });

  it('is released by removing the renderer with dispose, not by removing it alone', () => {
    const canvas = document.createElement('canvas');
    const world = new Gg3dWorld({ visualScene: visualScene() } as any);
    const renderer = world.addRenderer({} as any, canvas);
    world.removeEntity(renderer);
    world.addEntity(renderer);
    world.removeEntity(renderer, true);
    expect(() => world.addRenderer({} as any, canvas)).toThrow(/replaceCanvas/);
    world.dispose();
  });

  it('never blocks a renderer the adapter made a canvas for itself', () => {
    const world = new Gg3dWorld({ visualScene: visualScene() } as any);
    world.addRenderer({} as any).dispose();
    expect(() => world.addRenderer({} as any)).not.toThrow();
    world.dispose();
  });
});
