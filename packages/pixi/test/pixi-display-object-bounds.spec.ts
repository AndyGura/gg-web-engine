import { PixiFactory, PixiSceneComponent } from '../src';

// `getBoundings()` is in meters, the scene's world frame, whatever transform a renderer has put on
// the world container (it scales it by `zoom * pixelsPerMeter` and pivots it on the camera before
// every frame, and leaves it that way).
describe('PixiDisplayObjectComponent getBoundings', () => {
  let scene: PixiSceneComponent;
  let factory: PixiFactory;

  beforeEach(async () => {
    scene = new PixiSceneComponent();
    await scene.init();
    factory = new PixiFactory(scene);
  });

  afterEach(() => {
    scene.dispose();
  });

  const box = () => {
    const comp = factory.createPrimitive(
      { shape: 'BOX', dimensions: { x: 1, y: 2 } },
      { color: 0xff0000, stroke: { color: 0, width: 0 } },
    );
    comp.position = { x: 3, y: 4 };
    scene.nativeContainer!.addChild(comp.nativeSprite);
    return comp;
  };

  const expectMeters = (b: { min: { x: number; y: number }; max: { x: number; y: number } }) => {
    expect(b.min.x).toBeCloseTo(2.5, 5);
    expect(b.max.x).toBeCloseTo(3.5, 5);
    expect(b.min.y).toBeCloseTo(3, 5);
    expect(b.max.y).toBeCloseTo(5, 5);
  };

  it('is in meters before any renderer has drawn', () => {
    expectMeters(box().getBoundings());
  });

  it('is still in meters once a renderer has scaled and pivoted the world container', () => {
    const comp = box();
    const container = scene.nativeContainer!;
    container.scale.set(2 * scene.pixelsPerMeter);
    container.pivot.set(10, -7);
    container.position.set(400, 300);
    container.rotation = 0.3;
    expectMeters(comp.getBoundings());
    // the local bounds are in meters as well, and agree in size
    const local = comp.getLocalBoundings();
    expect(local.max.x - local.min.x).toBeCloseTo(1, 5);
    expect(local.max.y - local.min.y).toBeCloseTo(2, 5);
  });

  it('includes the transform of a parent inside the world', () => {
    const comp = box();
    const group = scene.nativeContainer!.addChild(new (require('pixi.js').Container)());
    group.position.set(1, 1);
    group.addChild(comp.nativeSprite);
    const b = comp.getBoundings();
    expect(b.min.x).toBeCloseTo(3.5, 5);
    expect(b.max.y).toBeCloseTo(6, 5);
  });
});
