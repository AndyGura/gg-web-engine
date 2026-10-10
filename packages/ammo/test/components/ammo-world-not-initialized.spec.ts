import { AmmoWorldComponent } from '../../src';

describe('AmmoWorldComponent before init()', () => {
  it('names the fix when the factory is used before the WASM module is initialized', () => {
    const world = new AmmoWorldComponent();
    expect(() => world.factory).toThrow(
      /AmmoWorldComponent is not initialized yet.*physicsWorld\.factory.*await world\.init\(\).*WASM module asynchronously/,
    );
    expect(() => world.loader).toThrow(/AmmoWorldComponent is not initialized yet.*await world\.init\(\)/);
  });

  it('accepts gravity before init and applies it once initialized', async () => {
    const world = new AmmoWorldComponent();
    world.gravity = { x: 0, y: 0, z: -3 };
    await world.init();
    expect(world.gravity).toEqual({ x: 0, y: 0, z: -3 });
    expect(world.dynamicAmmoWorld!.getGravity().z()).toBeCloseTo(-3);
    world.dispose();
  });
});
