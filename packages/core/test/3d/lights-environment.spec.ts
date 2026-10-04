import {
  Environment3dEntity,
  Environment3dOpts,
  Gg3dLevelLoader,
  Gg3dWorld,
  ILight3dComponent,
  Light3dDescriptor,
  Light3dEntity,
  LevelJson,
  Pnt3,
  Qtrn,
} from '../../src';
import { mock3DObject } from '../mocks/object.mock';

const mockLight = (descriptor: Light3dDescriptor): ILight3dComponent => {
  const result: any = {
    ...mock3DObject(),
    lightType: descriptor.type,
    color: descriptor.color ?? 0xffffff,
    intensity: descriptor.intensity ?? 1,
    castShadow: false,
  };
  // a getter inside a spread object literal is evaluated once, not kept live - define it afterwards
  Object.defineProperty(result, 'lightOptions', {
    get: (): Light3dDescriptor => ({ ...descriptor, color: result.color, intensity: result.intensity }),
  });
  return result as ILight3dComponent;
};

const mockScene = () => {
  let environment: Environment3dOpts<string> = { background: null, environmentMap: null, fog: null };
  return {
    factory: { createLight: jest.fn((d: Light3dDescriptor) => mockLight(d)) },
    loader: {
      loadCubeTexture: jest.fn(async () => 'cube-texture'),
      loadTexture: jest.fn(async () => 'equirect-texture'),
    },
    get environment() {
      return environment;
    },
    setEnvironment: jest.fn((e: Partial<Environment3dOpts<string>>) => {
      environment = { ...environment, ...e };
    }),
    dispose: () => {},
  };
};

describe('lights', () => {
  it('Gg3dWorld.addLight creates a Light3dEntity aimed at the target', () => {
    const visualScene = mockScene();
    const world = new Gg3dWorld({ visualScene: visualScene as any });
    const entity = world.addLight({ type: 'DIRECTIONAL', intensity: 2 }, { x: 10, y: 0, z: 10 }, Pnt3.O);
    expect(visualScene.factory.createLight).toHaveBeenCalledWith({ type: 'DIRECTIONAL', intensity: 2 });
    expect(entity).toBeInstanceOf(Light3dEntity);
    expect(entity.world).toBe(world);
    expect(entity.light.position).toEqual({ x: 10, y: 0, z: 10 });
    expect(entity.rotation).toEqual(Qtrn.lookAt({ x: 10, y: 0, z: 10 }, Pnt3.O));
    expect(entity.name).toMatch(/^Light3dEntity_/);
  });

  it('"Light" level class creates a light and serializes it back from its live settings', async () => {
    const visualScene = mockScene();
    const world = { visualScene, addEntity: jest.fn(), removeEntity: jest.fn() } as unknown as Gg3dWorld;
    const loader = new Gg3dLevelLoader(world);
    const level: LevelJson = {
      entities: [
        {
          class: 'Light',
          name: 'Sun',
          position: { x: 0, y: 0, z: 5 },
          config: { type: 'DIRECTIONAL', color: 0xffeedd, castShadow: true, shadow: { mapSize: 2048 }, target: Pnt3.O },
        },
      ],
    };
    const group = await loader.loadLevel(level, 'L');
    expect(visualScene.factory.createLight).toHaveBeenCalledWith({
      type: 'DIRECTIONAL',
      color: 0xffeedd,
      castShadow: true,
      shadow: { mapSize: 2048 },
    });
    const sun = group.getChildEntityByName<Light3dEntity>('Sun');
    expect(sun).toBeInstanceOf(Light3dEntity);
    expect(sun.rotation).toEqual(Qtrn.lookAt({ x: 0, y: 0, z: 5 }, Pnt3.O));

    sun.light.intensity = 3;
    const json = loader.serializeEntity(sun)!;
    expect(json.class).toBe('Light');
    expect(json.position).toEqual({ x: 0, y: 0, z: 5 });
    expect(json.config).toMatchObject({ type: 'DIRECTIONAL', color: 0xffeedd, intensity: 3 });
  });
});

describe('environment', () => {
  it('"Environment" level class loads sky textures and applies them only while spawned', async () => {
    const visualScene = mockScene();
    visualScene.setEnvironment({ fog: { type: 'EXPONENTIAL', color: 0, density: 0.1 } });
    const world = { visualScene, addEntity: jest.fn(), removeEntity: jest.fn() } as unknown as Gg3dWorld;
    const loader = new Gg3dLevelLoader(world);
    const faces = { px: 'px', nx: 'nx', py: 'py', ny: 'ny', pz: 'pz', nz: 'nz' };
    const group = await loader.loadLevel(
      {
        entities: [
          {
            class: 'Environment',
            name: 'Env',
            config: { background: { cube: faces }, environmentMap: { equirectangular: 'sky.hdr' }, fog: null },
          },
        ],
      },
      'L',
    );
    expect(visualScene.loader.loadCubeTexture).toHaveBeenCalledWith(faces);
    expect(visualScene.loader.loadTexture).toHaveBeenCalledWith('sky.hdr', { mapping: 'equirectangular' });
    const env = group.getChildEntityByName<Environment3dEntity>('Env');
    expect(env.environment).toEqual({ background: 'cube-texture', environmentMap: 'equirect-texture', fog: null });

    env.onSpawned(world as any);
    expect(visualScene.environment).toEqual({
      background: 'cube-texture',
      environmentMap: 'equirect-texture',
      fog: null,
    });
    env.onRemoved();
    expect(visualScene.environment).toEqual({
      background: null,
      environmentMap: null,
      fog: { type: 'EXPONENTIAL', color: 0, density: 0.1 },
    });
  });

  it('leaves fields it does not set untouched', () => {
    const visualScene = mockScene();
    visualScene.setEnvironment({ background: 0x123456 });
    const env = new Environment3dEntity<any>({ fog: { type: 'LINEAR', color: 0xffffff, near: 1, far: 10 } });
    env.onSpawned({ visualScene } as any);
    expect(visualScene.environment.background).toBe(0x123456);
    expect(visualScene.environment.fog).toEqual({ type: 'LINEAR', color: 0xffffff, near: 1, far: 10 });
    env.onRemoved();
    expect(visualScene.environment).toEqual({ background: 0x123456, environmentMap: null, fog: null });
  });
});
