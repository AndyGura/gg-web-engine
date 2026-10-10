import {
  audioSceneDimension,
  Gg2dWorld,
  Gg3dWorld,
  notInitializedError,
  physicsWorldDimension,
  registerCoreVersion,
  visualSceneDimension,
} from '../../src';
import { MockWorld } from '../mocks/world.mock';

const lifecycle = { init: async () => {}, dispose: () => {} };
const physics2d = () => ({ ...lifecycle, backendName: 'matter', gravity: { x: 0, y: 9.82 }, simulate: () => {} });
const physics3d = () => ({ ...lifecycle, backendName: 'ammo', gravity: { x: 0, y: 0, z: -9.82 }, simulate: () => {} });
const visual2d = () => ({ ...lifecycle, backendName: 'pixi', factory: { createParallaxLayer: () => null } });
const visual3d = () => ({ ...lifecycle, backendName: 'three', factory: {}, registerRenderLayer: () => 1 });
const audio3d = () => ({ ...lifecycle, backendName: 'webaudio', defaultPanningModel: 'HRTF', update: () => {} });

describe('setup errors', () => {
  describe('dimension detection', () => {
    it('tells 2D and 3D physics worlds apart by their gravity vector', () => {
      expect(physicsWorldDimension(physics2d())).toBe(2);
      expect(physicsWorldDimension(physics3d())).toBe(3);
      expect(physicsWorldDimension({})).toBeNull();
    });

    it('tells 2D and 3D visual scenes apart by members only one of them declares', () => {
      expect(visualSceneDimension(visual2d())).toBe(2);
      expect(visualSceneDimension(visual3d())).toBe(3);
      expect(visualSceneDimension({ factory: { createLight: () => null } })).toBe(3);
      expect(visualSceneDimension({})).toBeNull();
    });

    it('does not throw for a scene whose getter throws before init', () => {
      const scene = {
        get factory(): unknown {
          throw new Error('not initialized');
        },
      };
      expect(visualSceneDimension(scene)).toBeNull();
    });

    it('recognizes a 3D audio scene', () => {
      expect(audioSceneDimension(audio3d())).toBe(3);
      expect(audioSceneDimension({})).toBeNull();
    });
  });

  describe('mismatched world dimensions', () => {
    it('Gg3dWorld rejects a 2D physics world, naming Gg2dWorld and the 3D backends', () => {
      expect(() => new Gg3dWorld({ visualScene: visual3d() as any, physicsWorld: physics2d() as any })).toThrow(
        /Gg3dWorld was given a 2D physicsWorld \("matter"\).*@gg-web-engine\/ammo or @gg-web-engine\/rapier3d.*Gg2dWorld/,
      );
    });

    it('Gg3dWorld rejects a 2D visual scene', () => {
      expect(() => new Gg3dWorld({ visualScene: visual2d() as any })).toThrow(
        /Gg3dWorld was given a 2D visualScene \("pixi"\).*@gg-web-engine\/three/,
      );
    });

    it('Gg2dWorld rejects a 3D visual scene, physics world and audio scene', () => {
      expect(() => new Gg2dWorld({ visualScene: visual3d() as any })).toThrow(
        /Gg2dWorld was given a 3D visualScene \("three"\).*belongs in a Gg3dWorld/,
      );
      expect(() => new Gg2dWorld({ physicsWorld: physics3d() as any })).toThrow(
        /Gg2dWorld was given a 3D physicsWorld \("ammo"\).*@gg-web-engine\/matter or @gg-web-engine\/rapier2d/,
      );
      expect(() => new Gg2dWorld({ audioScene: audio3d() as any })).toThrow(/Gg2dWorld was given a 3D audioScene/);
    });

    it('accepts matching scenes and scenes whose dimension it cannot infer', () => {
      const worlds = [
        new Gg3dWorld({ visualScene: visual3d() as any, physicsWorld: physics3d() as any, audioScene: audio3d() as any }),
        new Gg2dWorld({ visualScene: visual2d() as any, physicsWorld: physics2d() as any }),
        new Gg3dWorld({ visualScene: { ...lifecycle } as any, physicsWorld: { ...lifecycle } as any }),
      ];
      worlds.forEach(w => w.dispose());
    });
  });

  describe('missing visual scene', () => {
    it('addParticleSystem names the constructor argument to pass, in 3D and 2D', () => {
      const w3 = new Gg3dWorld({ physicsWorld: physics3d() as any });
      expect(() => w3.addParticleSystem({ capacity: 4 } as any)).toThrow(
        "pass a `visualScene` (e.g. @gg-web-engine/three's ThreeSceneComponent) to the Gg3dWorld constructor",
      );
      const w2 = new Gg2dWorld({ physicsWorld: physics2d() as any });
      expect(() => w2.addParticleSystem({ capacity: 4 } as any)).toThrow(
        "pass a `visualScene` (e.g. @gg-web-engine/pixi's PixiSceneComponent) to the Gg2dWorld constructor",
      );
      w3.dispose();
      w2.dispose();
    });
  });

  describe('init()', () => {
    it('warns when start() is called before init(), and not after', async () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        const early = new MockWorld();
        early.start();
        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn.mock.calls[0][0]).toMatch(/start\(\) was called before init\(\).*await world\.init\(\)/);
        early.dispose();

        warn.mockClear();
        const w = new MockWorld();
        await w.init();
        w.start();
        expect(warn).not.toHaveBeenCalled();
        w.dispose();
      } finally {
        warn.mockRestore();
      }
    });

    it('a second init() returns the same run: scenes initialize once and the tick loop is hooked up once', async () => {
      const physicsWorld = { init: jest.fn(async () => {}), simulate: jest.fn(), dispose: () => {} };
      const w = new MockWorld({ physicsWorld });
      expect(w.isInitialized).toBe(false);
      const first = w.init();
      expect(w.init()).toBe(first);
      await first;
      await w.init();
      expect(w.isInitialized).toBe(true);
      expect(physicsWorld.init).toHaveBeenCalledTimes(1);
      w.worldClock.start();
      w.worldClock.pause();
      w.worldClock.step(16);
      expect(physicsWorld.simulate).toHaveBeenCalledTimes(1);
      w.dispose();
    });

    it('a failed init() can be retried', async () => {
      let fail = true;
      const physicsWorld = {
        init: jest.fn(async () => {
          if (fail) {
            throw new Error('wasm fetch failed');
          }
        }),
        simulate: () => {},
        dispose: () => {},
      };
      const w = new MockWorld({ physicsWorld });
      await expect(w.init()).rejects.toThrow('wasm fetch failed');
      expect(w.isInitialized).toBe(false);
      fail = false;
      await w.init();
      expect(w.isInitialized).toBe(true);
      expect(physicsWorld.init).toHaveBeenCalledTimes(2);
      w.dispose();
    });
  });

  describe('notInitializedError', () => {
    it('names the component, what was attempted and the fix', () => {
      const e = notInitializedError('SomeWorldComponent', 'physicsWorld', 'creating bodies', 'it loads WASM');
      expect(e.message).toBe(
        "SomeWorldComponent is not initialized yet, so it can't be used for creating bodies. " +
          'Call `await world.init()` before adding entities, loading a level or starting the world ' +
          '(or `await physicsWorld.init()` when using the physicsWorld without a world); it loads WASM.',
      );
    });
  });

  describe('registerCoreVersion', () => {
    afterEach(() => {
      delete (window as any).gg_core_versions;
    });

    it('is silent while every loaded core copy has the same version', () => {
      (window as any).gg_core_versions = [];
      const error = jest.spyOn(console, 'error').mockImplementation(() => {});
      try {
        registerCoreVersion('1.2.3');
        registerCoreVersion('1.2.3');
        expect(error).not.toHaveBeenCalled();
      } finally {
        error.mockRestore();
      }
    });

    it('reports a second, different core version, naming both and how to align them', () => {
      (window as any).gg_core_versions = [];
      const error = jest.spyOn(console, 'error').mockImplementation(() => {});
      try {
        registerCoreVersion('1.2.3');
        registerCoreVersion('1.2.4');
        expect(error).toHaveBeenCalledTimes(1);
        const message = error.mock.calls[0][0] as string;
        expect(message).toContain('1.2.3, 1.2.4');
        expect(message).toContain('npm install @gg-web-engine/core@1.2.4');
        expect(message).toContain('npm ls @gg-web-engine/core');
      } finally {
        error.mockRestore();
      }
    });
  });
});
