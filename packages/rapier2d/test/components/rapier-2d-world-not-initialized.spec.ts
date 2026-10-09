import { Rapier2dWorldComponent } from '../../src';

describe('Rapier2dWorldComponent before init()', () => {
  it('names the fix when used before the WASM module is initialized', () => {
    const world = new Rapier2dWorldComponent();
    expect(() => world.factory).toThrow(
      /Rapier2dWorldComponent is not initialized yet.*physicsWorld\.factory.*await world\.init\(\).*WASM module asynchronously/,
    );
    expect(() => world.nativeWorld).toThrow(/Rapier2dWorldComponent is not initialized yet.*await world\.init\(\)/);
  });

  it('accepts gravity before init and applies it once initialized', async () => {
    const world = new Rapier2dWorldComponent();
    world.gravity = { x: 0, y: 3 };
    await world.init();
    expect(world.gravity.y).toBeCloseTo(3);
    world.dispose();
  });
});
