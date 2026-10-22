// Shared contract suite for 2D rendering adapters, run from each adapter's test folder:
//
//   import { describeVisual2dContract } from '../../../core/test/contract/visual-2d.contract';
//   describeVisual2dContract('pixi', () => new PixiFactory());
//
// It checks what an app relies on when it swaps renderers: the factory builds every primitive,
// sizes are in pixels with the same axes as 2D physics (a capsule stands along Y), transforms read
// back as set, and clones are independent. It needs no GPU, so it does not check pixels.
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

export function describeVisual2dContract(backend: string, createFactory: () => IDisplayObject2dComponentFactory): void {
  describe(`2D visual contract: ${backend}`, () => {
    let factory: IDisplayObject2dComponentFactory;

    beforeEach(() => {
      factory = createFactory();
    });

    const sized: [Shape2DDescriptor, Point2][] = [
      [
        { shape: 'BOX', dimensions: { x: 10, y: 20 } },
        { x: 10, y: 20 },
      ],
      [
        { shape: 'CIRCLE', radius: 10 },
        { x: 20, y: 20 },
      ],
      [
        { shape: 'CAPSULE', radius: 10, centersDistance: 30 },
        { x: 20, y: 50 },
      ],
      [
        {
          shape: 'POLYGON',
          vertices: [
            { x: 0, y: 0 },
            { x: 40, y: 0 },
            { x: 40, y: 10 },
          ],
        },
        { x: 40, y: 10 },
      ],
      [
        {
          shape: 'CONVEX_HULL',
          vertices: [
            { x: 0, y: 0 },
            { x: 40, y: 0 },
            { x: 40, y: 10 },
          ],
        },
        { x: 40, y: 10 },
      ],
      [
        {
          shape: 'COMPOUND',
          children: [
            { position: { x: -20, y: 0 }, shape: { shape: 'BOX', dimensions: { x: 10, y: 10 } } },
            { position: { x: 20, y: 0 }, shape: { shape: 'BOX', dimensions: { x: 10, y: 10 } } },
          ],
        },
        { x: 50, y: 10 },
      ],
    ];
    for (const [descriptor, expected] of sized) {
      it(`builds a ${descriptor.shape} sized in pixels`, () => {
        const s = size(factory.createPrimitive(descriptor, { color: 0xff0000 }));
        // a renderer may pad the bounds by a pixel or so for antialiasing or a stroke
        expect(Math.abs(s.x - expected.x)).toBeLessThan(2);
        expect(Math.abs(s.y - expected.y)).toBeLessThan(2);
      });
    }

    it('starts every primitive at scale 1, whatever its size', () => {
      const box = factory.createBox({ x: 10, y: 40 }, { color: 0xffffff });
      expect(box.scale).toEqual({ x: expect.closeTo(1), y: expect.closeTo(1) });
    });

    it('reads position, rotation, scale, visibility, zIndex, tint and opacity back as set', () => {
      const box = factory.createBox({ x: 10, y: 10 }, { color: 0xffffff });
      box.position = { x: 10, y: 20 };
      box.rotation = 0.5;
      box.scale = { x: 2, y: 3 };
      box.visible = false;
      box.zIndex = 5;
      box.tint = 0x00ff00;
      box.opacity = 0.25;
      expect(box.position).toEqual({ x: expect.closeTo(10), y: expect.closeTo(20) });
      expect(box.rotation).toBeCloseTo(0.5);
      expect(box.scale).toEqual({ x: expect.closeTo(2), y: expect.closeTo(3) });
      expect(box.visible).toBe(false);
      expect(box.zIndex).toBe(5);
      expect(box.tint).toBe(0x00ff00);
      expect(box.opacity).toBeCloseTo(0.25);
    });

    it('applies position and scale to its boundings', () => {
      const box = factory.createBox({ x: 10, y: 10 }, { color: 0xffffff });
      box.position = { x: 100, y: 200 };
      box.scale = { x: 2, y: 3 };
      const { min, max } = box.getBoundings();
      expect((min.x + max.x) / 2).toBeCloseTo(100, 0);
      expect((min.y + max.y) / 2).toBeCloseTo(200, 0);
      expect(Math.abs(max.x - min.x - 20)).toBeLessThan(3);
      expect(Math.abs(max.y - min.y - 30)).toBeLessThan(3);
    });

    it('measures local boundings in its own frame, whatever its transform', () => {
      const box = factory.createBox({ x: 10, y: 20 }, { color: 0xffffff });
      box.position = { x: 100, y: 200 };
      box.rotation = 0.7;
      box.scale = { x: 2, y: 3 };
      const { min, max } = box.getLocalBoundings();
      // a renderer may pad the bounds by a pixel or so
      expect((min.x + max.x) / 2).toBeCloseTo(0, 0);
      expect((min.y + max.y) / 2).toBeCloseTo(0, 0);
      expect(Math.abs(max.x - min.x - 10)).toBeLessThan(2);
      expect(Math.abs(max.y - min.y - 20)).toBeLessThan(2);
    });

    it('counts children of local boundings with their own transforms, leaving hidden ones out', () => {
      const parent = factory.createPrimitive(
        {
          shape: 'COMPOUND',
          children: [{ position: { x: 0, y: 0 }, shape: { shape: 'BOX', dimensions: { x: 10, y: 10 } } }],
        },
        { color: 0xffffff },
      );
      parent.position = { x: 50, y: 50 };
      parent.rotation = 1;
      const child = factory.createBox({ x: 10, y: 10 }, { color: 0xffffff });
      child.position = { x: 0, y: 30 };
      parent.addChild(child);
      const hidden = factory.createBox({ x: 10, y: 10 }, { color: 0xffffff });
      hidden.position = { x: 0, y: -100 };
      hidden.visible = false;
      parent.addChild(hidden);
      const { min, max } = parent.getLocalBoundings();
      expect(Math.abs(min.x + 5)).toBeLessThan(2);
      expect(Math.abs(max.x - 5)).toBeLessThan(2);
      expect(Math.abs(min.y + 5)).toBeLessThan(2);
      expect(Math.abs(max.y - 35)).toBeLessThan(2);
    });

    it('clones into an independent object with the same transform', () => {
      const box = factory.createBox({ x: 10, y: 20 }, { color: 0xffffff });
      box.position = { x: 10, y: 20 };
      box.scale = { x: 2, y: 2 };
      const copy = box.clone();
      expect(copy).not.toBe(box);
      expect(copy.position).toEqual({ x: expect.closeTo(10), y: expect.closeTo(20) });
      expect(copy.scale).toEqual({ x: expect.closeTo(2), y: expect.closeTo(2) });
      expect(Math.abs(size(copy).x - 20)).toBeLessThan(3);
      copy.position = { x: 90, y: 90 };
      expect(box.position.x).toBeCloseTo(10);
    });

    it('nests children by name: addChild, popChild, removeChild', () => {
      const parent = factory.createBox({ x: 10, y: 10 }, { color: 0xffffff });
      const child = factory.createCircle(5, { color: 0xffffff });
      child.name = 'eye';
      parent.addChild(child);
      expect(parent.popChild('eye')).not.toBeNull();
      expect(parent.popChild('eye')).toBeNull();
      const other = factory.createCircle(5, { color: 0xffffff });
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
