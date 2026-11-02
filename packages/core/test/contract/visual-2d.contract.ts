// Shared contract suite for 2D rendering adapters, run from each adapter's test folder:
//
//   import { describeVisual2dContract } from '../../../core/test/contract/visual-2d.contract';
//   describeVisual2dContract('pixi', () => new PixiFactory());
//
// It checks what an app relies on when it swaps renderers: the factory builds every primitive,
// sizes are in meters with the same axes as 2D physics (a capsule stands along Y), transforms read
// back as set, and clones are independent. It needs no GPU, so it does not check pixels. Bounds
// are allowed a padding of `tolerance` meters (0.02 by default: a pixel or so of antialiasing or
// stroke at an adapter's usual 100 pixels per meter).
import {
  IDisplayObject2dComponent,
  IDisplayObject2dComponentFactory,
  Point2,
  Shape2DDescriptor,
} from '@gg-web-engine/core';

const size = (o: Pick<IDisplayObject2dComponent, 'getBoundings'>): Point2 => {
  const { min, max } = o.getBoundings();
  return { x: max.x - min.x, y: max.y - min.y };
};

export function describeVisual2dContract(
  backend: string,
  createFactory: () => IDisplayObject2dComponentFactory,
  options: { tolerance?: number } = {},
): void {
  const tolerance = options.tolerance ?? 0.02;
  // `|a - b| < tolerance`, with the values in the failure message
  const expectClose = (actual: number, expected: number, padding: number = tolerance) => {
    expect(Math.abs(actual - expected)).toBeLessThan(padding);
  };

  describe(`2D visual contract: ${backend}`, () => {
    let factory: IDisplayObject2dComponentFactory;

    beforeEach(() => {
      factory = createFactory();
    });

    const sized: [Shape2DDescriptor, Point2][] = [
      [
        { shape: 'BOX', dimensions: { x: 0.1, y: 0.2 } },
        { x: 0.1, y: 0.2 },
      ],
      [
        { shape: 'CIRCLE', radius: 0.1 },
        { x: 0.2, y: 0.2 },
      ],
      [
        { shape: 'CAPSULE', radius: 0.1, centersDistance: 0.3 },
        { x: 0.2, y: 0.5 },
      ],
      [
        {
          shape: 'POLYGON',
          vertices: [
            { x: 0, y: 0 },
            { x: 0.4, y: 0 },
            { x: 0.4, y: 0.1 },
          ],
        },
        { x: 0.4, y: 0.1 },
      ],
      [
        {
          shape: 'CONVEX_HULL',
          vertices: [
            { x: 0, y: 0 },
            { x: 0.4, y: 0 },
            { x: 0.4, y: 0.1 },
          ],
        },
        { x: 0.4, y: 0.1 },
      ],
      [
        {
          shape: 'COMPOUND',
          children: [
            { position: { x: -0.2, y: 0 }, shape: { shape: 'BOX', dimensions: { x: 0.1, y: 0.1 } } },
            { position: { x: 0.2, y: 0 }, shape: { shape: 'BOX', dimensions: { x: 0.1, y: 0.1 } } },
          ],
        },
        { x: 0.5, y: 0.1 },
      ],
    ];
    for (const [descriptor, expected] of sized) {
      it(`builds a ${descriptor.shape} sized in meters`, () => {
        const s = size(factory.createPrimitive(descriptor, { color: 0xff0000 }));
        // a renderer may pad the bounds by a pixel or so for antialiasing or a stroke
        expectClose(s.x, expected.x);
        expectClose(s.y, expected.y);
      });
    }

    it('builds a large primitive as readily as a small one', () => {
      const s = size(factory.createBox({ x: 30, y: 12 }, { color: 0xff0000 }));
      expectClose(s.x, 30);
      expectClose(s.y, 12);
    });

    it('starts every primitive at scale 1, whatever its size', () => {
      const box = factory.createBox({ x: 0.1, y: 0.4 }, { color: 0xffffff });
      expect(box.scale).toEqual({ x: expect.closeTo(1), y: expect.closeTo(1) });
    });

    it('reads position, rotation, scale, visibility, zIndex, tint and opacity back as set', () => {
      const box = factory.createBox({ x: 0.1, y: 0.1 }, { color: 0xffffff });
      box.position = { x: 1, y: 2 };
      box.rotation = 0.5;
      box.scale = { x: 2, y: 3 };
      box.visible = false;
      box.zIndex = 5;
      box.tint = 0x00ff00;
      box.opacity = 0.25;
      expect(box.position).toEqual({ x: expect.closeTo(1), y: expect.closeTo(2) });
      expect(box.rotation).toBeCloseTo(0.5);
      expect(box.scale).toEqual({ x: expect.closeTo(2), y: expect.closeTo(3) });
      expect(box.visible).toBe(false);
      expect(box.zIndex).toBe(5);
      expect(box.tint).toBe(0x00ff00);
      expect(box.opacity).toBeCloseTo(0.25);
    });

    it('applies position and scale to its boundings', () => {
      const box = factory.createBox({ x: 0.1, y: 0.1 }, { color: 0xffffff });
      box.position = { x: 1, y: 2 };
      box.scale = { x: 2, y: 3 };
      const { min, max } = box.getBoundings();
      expectClose((min.x + max.x) / 2, 1);
      expectClose((min.y + max.y) / 2, 2);
      expectClose(max.x - min.x, 0.2, tolerance * 1.5);
      expectClose(max.y - min.y, 0.3, tolerance * 1.5);
    });

    it('measures local boundings in its own frame, whatever its transform', () => {
      const box = factory.createBox({ x: 0.1, y: 0.2 }, { color: 0xffffff });
      box.position = { x: 1, y: 2 };
      box.rotation = 0.7;
      box.scale = { x: 2, y: 3 };
      const { min, max } = box.getLocalBoundings();
      // a renderer may pad the bounds by a pixel or so
      expectClose((min.x + max.x) / 2, 0);
      expectClose((min.y + max.y) / 2, 0);
      expectClose(max.x - min.x, 0.1);
      expectClose(max.y - min.y, 0.2);
    });

    it('counts children of local boundings with their own transforms, leaving hidden ones out', () => {
      const parent = factory.createPrimitive(
        {
          shape: 'COMPOUND',
          children: [{ position: { x: 0, y: 0 }, shape: { shape: 'BOX', dimensions: { x: 0.1, y: 0.1 } } }],
        },
        { color: 0xffffff },
      );
      parent.position = { x: 0.5, y: 0.5 };
      parent.rotation = 1;
      const child = factory.createBox({ x: 0.1, y: 0.1 }, { color: 0xffffff });
      child.position = { x: 0, y: 0.3 };
      parent.addChild(child);
      const hidden = factory.createBox({ x: 0.1, y: 0.1 }, { color: 0xffffff });
      hidden.position = { x: 0, y: -1 };
      hidden.visible = false;
      parent.addChild(hidden);
      const { min, max } = parent.getLocalBoundings();
      expectClose(min.x, -0.05);
      expectClose(max.x, 0.05);
      expectClose(min.y, -0.05);
      expectClose(max.y, 0.35);
    });

    it('clones into an independent object with the same transform', () => {
      const box = factory.createBox({ x: 0.1, y: 0.2 }, { color: 0xffffff });
      box.position = { x: 1, y: 2 };
      box.scale = { x: 2, y: 2 };
      const copy = box.clone();
      expect(copy).not.toBe(box);
      expect(copy.position).toEqual({ x: expect.closeTo(1), y: expect.closeTo(2) });
      expect(copy.scale).toEqual({ x: expect.closeTo(2), y: expect.closeTo(2) });
      expectClose(size(copy).x, 0.2, tolerance * 1.5);
      copy.position = { x: 9, y: 9 };
      expect(box.position.x).toBeCloseTo(1);
    });

    it('nests children by name: addChild, popChild, removeChild', () => {
      const parent = factory.createBox({ x: 0.1, y: 0.1 }, { color: 0xffffff });
      const child = factory.createCircle(0.05, { color: 0xffffff });
      child.name = 'eye';
      parent.addChild(child);
      expect(parent.popChild('eye')).not.toBeNull();
      expect(parent.popChild('eye')).toBeNull();
      const other = factory.createCircle(0.05, { color: 0xffffff });
      parent.addChild(other);
      parent.removeChild(other);
    });

    it('creates text and a camera', () => {
      expect(factory.createText('hello', { fontSize: 16 } as any)).toBeTruthy();
      expect(factory.createCamera()).toBeTruthy();
    });

    it('creates a camera centered on its position at zoom 1, whose origin can be the top-left corner', () => {
      const camera = factory.createCamera();
      expect(camera.zoom).toBe(1);
      expect(camera.origin).toBe('center');
      camera.origin = 'top-left';
      expect(camera.origin).toBe('top-left');
    });
  });
}
