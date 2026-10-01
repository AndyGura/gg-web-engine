import { AmmoWorldComponent } from '../../src';

jest.mock('../../src/ammo.js/ammo', () => {
  const actual = jest.requireActual('../../src/ammo.js/ammo');
  const factory = actual.default ?? actual;
  let failNext = true;
  const wrapped = function (this: unknown, ...args: unknown[]) {
    if (failNext) {
      failNext = false;
      return Promise.reject(new Error('failed to fetch ammo.wasm'));
    }
    return factory.apply(this, args);
  };
  return { __esModule: true, default: wrapped };
});

describe('AmmoWorldComponent module initialization', () => {
  it('retries after a failed initialization instead of failing every later init()', async () => {
    await expect(new AmmoWorldComponent().init()).rejects.toThrow('failed to fetch ammo.wasm');
    const world = new AmmoWorldComponent();
    await world.init();
    expect(world.dynamicAmmoWorld).toBeDefined();
    world.dispose();
  });
});
