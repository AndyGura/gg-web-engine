import { Rapier3dWorldComponent } from '../../src';

describe('Rapier3dWorldComponent before init()', () => {
  it('names the fix when used before the WASM module is initialized', () => {
    const world = new Rapier3dWorldComponent();
    expect(() => world.factory).toThrow(
      /Rapier3dWorldComponent is not initialized yet.*physicsWorld\.factory.*await world\.init\(\).*WASM module asynchronously/,
    );
    expect(() => world.nativeWorld).toThrow(/Rapier3dWorldComponent is not initialized yet.*await world\.init\(\)/);
  });

  it('accepts gravity before init and applies it once initialized', async () => {
    const world = new Rapier3dWorldComponent();
    world.gravity = { x: 0, y: 0, z: -3 };
    await world.init();
    expect(world.nativeWorld.gravity.z).toBeCloseTo(-3);
    world.dispose();
  });
});
