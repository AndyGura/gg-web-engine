// Shared contract suite for 3D rendering adapters, run from each adapter's test folder:
//
//   import { describeVisual3dContract } from '../../../core/test/contract/visual-3d.contract';
//   describeVisual3dContract('three', () => new ThreeFactory());
//
// It checks what an app relies on when it swaps renderers: the factory builds every primitive,
// lengths are in meters and Z is up (a cylinder's height runs along Z), transforms read back as
// set, and clones are independent. It needs no GPU, so it does not check pixels, materials or
// lighting, which stay renderer-specific.
import {
  IDisplayObject3dComponent,
  IDisplayObject3dComponentFactory,
  Point3,
  Qtrn,
  Shape3DMeshDescriptor,
} from '@gg-web-engine/core';

const size = (o: IDisplayObject3dComponent): Point3 => {
  const { min, max } = o.getBoundings();
  return { x: max.x - min.x, y: max.y - min.y, z: max.z - min.z };
};

export type Visual3dContractOptions = {
  /** Primitive shapes the renderer cannot draw; asking for one must fail with an error. */
  unsupportedShapes?: Shape3DMeshDescriptor['shape'][];
};

export function describeVisual3dContract(
  backend: string,
  createFactory: () => IDisplayObject3dComponentFactory,
  options: Visual3dContractOptions = {},
): void {
  const unsupported = new Set(options.unsupportedShapes ?? []);
  describe(`3D visual contract: ${backend}`, () => {
    let factory: IDisplayObject3dComponentFactory;

    beforeEach(() => {
      factory = createFactory();
    });

    const sized: [Shape3DMeshDescriptor, Point3][] = [
      [
        { shape: 'BOX', dimensions: { x: 1, y: 2, z: 3 } },
        { x: 1, y: 2, z: 3 },
      ],
      [
        { shape: 'SPHERE', radius: 0.5 },
        { x: 1, y: 1, z: 1 },
      ],
      [
        { shape: 'CYLINDER', radius: 0.5, height: 3 },
        { x: 1, y: 1, z: 3 },
      ],
      [
        { shape: 'CONE', radius: 0.5, height: 3 },
        { x: 1, y: 1, z: 3 },
      ],
      [
        { shape: 'CAPSULE', radius: 0.5, centersDistance: 2 },
        { x: 1, y: 1, z: 3 },
      ],
    ];
    for (const [descriptor, expected] of sized) {
      it(`builds a ${descriptor.shape} sized in meters, its long axis along Z`, () => {
        const s = size(factory.createPrimitive(descriptor));
        expect(s.x).toBeCloseTo(expected.x, 1);
        expect(s.y).toBeCloseTo(expected.y, 1);
        expect(s.z).toBeCloseTo(expected.z, 1);
      });
    }

    it('builds a PLANE lying in the XY ground plane (flat along Z)', () => {
      const s = size(factory.createPrimitive({ shape: 'PLANE', dimensions: { x: 4, y: 2 } }));
      expect(s.x).toBeCloseTo(4, 1);
      expect(s.y).toBeCloseTo(2, 1);
      expect(s.z).toBeCloseTo(0, 1);
    });

    it('builds a COMPOUND primitive from positioned children', () => {
      const compound = factory.createPrimitive({
        shape: 'COMPOUND',
        children: [
          { position: { x: -1, y: 0, z: 0 }, shape: { shape: 'BOX', dimensions: { x: 1, y: 1, z: 1 } } },
          { position: { x: 1, y: 0, z: 0 }, shape: { shape: 'BOX', dimensions: { x: 1, y: 1, z: 1 } } },
        ],
      });
      expect(size(compound).x).toBeCloseTo(3, 1);
    });

    const vertices = [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
      { x: 0, y: 1, z: 0 },
      { x: 0, y: 0, z: 1 },
    ];
    const vertexShapes: Shape3DMeshDescriptor[] = [
      { shape: 'CONVEX_HULL', vertices },
      {
        shape: 'MESH',
        vertices,
        faces: [
          [0, 1, 2],
          [0, 1, 3],
          [0, 2, 3],
          [1, 2, 3],
        ],
      },
    ];
    for (const descriptor of vertexShapes) {
      if (unsupported.has(descriptor.shape)) {
        it(`refuses a ${descriptor.shape} primitive with an error`, () => {
          expect(() => factory.createPrimitive(descriptor)).toThrow();
        });
      } else {
        it(`builds a ${descriptor.shape} primitive spanning its vertices`, () => {
          const s = size(factory.createPrimitive(descriptor));
          expect(s.x).toBeCloseTo(1, 1);
          expect(s.y).toBeCloseTo(1, 1);
          expect(s.z).toBeCloseTo(1, 1);
        });
      }
    }

    it('reads position, rotation, scale and visibility back as set', () => {
      const box = factory.createBox({ x: 1, y: 1, z: 1 });
      const rotation = Qtrn.fromEuler({ x: 0.1, y: 0.2, z: 0.3 });
      box.position = { x: 1, y: 2, z: 3 };
      box.rotation = rotation;
      box.scale = { x: 2, y: 3, z: 4 };
      box.visible = false;
      expect(box.position).toEqual({ x: expect.closeTo(1), y: expect.closeTo(2), z: expect.closeTo(3) });
      expect(box.rotation).toEqual({
        x: expect.closeTo(rotation.x),
        y: expect.closeTo(rotation.y),
        z: expect.closeTo(rotation.z),
        w: expect.closeTo(rotation.w),
      });
      expect(box.scale).toEqual({ x: expect.closeTo(2), y: expect.closeTo(3), z: expect.closeTo(4) });
      expect(box.visible).toBe(false);
    });

    it('applies scale to its boundings', () => {
      const box = factory.createBox({ x: 1, y: 1, z: 1 });
      box.scale = { x: 2, y: 3, z: 4 };
      const s = size(box);
      expect(s.x).toBeCloseTo(2, 1);
      expect(s.y).toBeCloseTo(3, 1);
      expect(s.z).toBeCloseTo(4, 1);
    });

    it('clones into an independent object with the same transform', () => {
      const box = factory.createBox({ x: 1, y: 2, z: 3 });
      box.position = { x: 1, y: 2, z: 3 };
      box.scale = { x: 2, y: 2, z: 2 };
      const copy = box.clone();
      expect(copy).not.toBe(box);
      expect(copy.position).toEqual({ x: expect.closeTo(1), y: expect.closeTo(2), z: expect.closeTo(3) });
      expect(copy.scale).toEqual({ x: expect.closeTo(2), y: expect.closeTo(2), z: expect.closeTo(2) });
      copy.position = { x: 9, y: 9, z: 9 };
      expect(box.position.x).toBeCloseTo(1);
      expect(size(copy).z).toBeCloseTo(6, 1);
    });

    it('nests children by name: addChild, popChild, removeChild', () => {
      const parent = factory.createBox({ x: 1, y: 1, z: 1 });
      const child = factory.createSphere(0.5);
      child.name = 'wheel';
      parent.addChild(child);
      const popped = parent.popChild('wheel');
      expect(popped).not.toBeNull();
      expect(parent.popChild('wheel')).toBeNull();
      const other = factory.createSphere(0.5);
      parent.addChild(other);
      parent.removeChild(other);
    });

    it('toggles shadows', () => {
      const box = factory.createBox({ x: 1, y: 1, z: 1 });
      box.castShadow = true;
      box.receiveShadow = true;
      expect(box.castShadow).toBe(true);
      expect(box.receiveShadow).toBe(true);
    });

    it('creates a perspective camera and every kind of light', () => {
      expect(factory.createPerspectiveCamera({ fov: 60, aspectRatio: 1.5 })).toBeTruthy();
      for (const type of ['AMBIENT', 'HEMISPHERE', 'DIRECTIONAL', 'POINT', 'SPOT'] as const) {
        expect(factory.createLight({ type, color: 0xffffff, intensity: 1 })).toBeTruthy();
      }
    });
  });
}
