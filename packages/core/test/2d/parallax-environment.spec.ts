import {
  Environment2dEntity,
  Environment2dOpts,
  Gg2dLevelLoader,
  Gg2dWorld,
  ParallaxLayer2dEntity,
  ParallaxLayer2dOpts,
  resolveParallaxLayer2dOpts,
} from '../../src';
import { mock2DObject } from '../mocks/object.mock';

const mockScene = () => {
  let environment: Environment2dOpts<string> = { background: null };
  return {
    factory: {
      createParallaxLayer: jest.fn((options: ParallaxLayer2dOpts<string>) => {
        const resolved = resolveParallaxLayer2dOpts(options);
        return { ...mock2DObject(), layerOptions: resolved, parallax: resolved.parallax, offset: resolved.offset };
      }),
      loadTexture: jest.fn(async (url: string) => `texture:${url}`),
    },
    get environment() {
      return environment;
    },
    setEnvironment: jest.fn((e: Partial<Environment2dOpts<string>>) => {
      environment = { ...environment, ...e };
    }),
    dispose: () => {},
  };
};

describe('parallax layers', () => {
  it('resolves defaults and per-axis shorthands', () => {
    expect(resolveParallaxLayer2dOpts({ texture: 't' })).toEqual({
      texture: 't',
      parallax: { x: 0.5, y: 0.5 },
      zIndex: -1,
      repeat: 'x',
      offset: { x: 0, y: 0 },
      scale: { x: 1, y: 1 },
    });
    expect(resolveParallaxLayer2dOpts({ texture: 't', parallax: 0.2, scale: 2 })).toMatchObject({
      parallax: { x: 0.2, y: 0.2 },
      scale: { x: 2, y: 2 },
    });
  });

  it('Gg2dWorld.addParallaxLayer wraps the layer in an entity and adds it', () => {
    const visualScene = mockScene();
    const world = new Gg2dWorld({ visualScene: visualScene as any });
    const entity = world.addParallaxLayer({ texture: 'hills', parallax: { x: 0.3, y: 0 }, zIndex: -5 });
    expect(visualScene.factory.createParallaxLayer).toHaveBeenCalledWith({
      texture: 'hills',
      parallax: { x: 0.3, y: 0 },
      zIndex: -5,
    });
    expect(entity).toBeInstanceOf(ParallaxLayer2dEntity);
    expect(entity.world).toBe(world);
    expect(entity.name).toMatch(/^ParallaxLayer2dEntity_/);
  });

  it('"ParallaxLayer" level class loads the texture and creates a layer', async () => {
    const visualScene = mockScene();
    const world = { visualScene, addEntity: jest.fn(), removeEntity: jest.fn() } as unknown as Gg2dWorld;
    const loader = new Gg2dLevelLoader(world);
    const group = await loader.loadLevel(
      {
        entities: [
          { class: 'ParallaxLayer', name: 'Hills', config: { texture: 'hills.png', parallax: 0.4, repeat: 'both' } },
        ],
      },
      'L',
    );
    expect(visualScene.factory.loadTexture).toHaveBeenCalledWith('hills.png');
    expect(visualScene.factory.createParallaxLayer).toHaveBeenCalledWith(
      expect.objectContaining({ texture: 'texture:hills.png', parallax: 0.4, repeat: 'both' }),
    );
    expect(group.getChildEntityByName('Hills')).toBeInstanceOf(ParallaxLayer2dEntity);
  });
});

describe('2D environment', () => {
  it('"Environment" level class loads a background image and applies it only while spawned', async () => {
    const visualScene = mockScene();
    visualScene.setEnvironment({ background: 0x123456 });
    const world = { visualScene, addEntity: jest.fn(), removeEntity: jest.fn() } as unknown as Gg2dWorld;
    const loader = new Gg2dLevelLoader(world);
    const group = await loader.loadLevel(
      { entities: [{ class: 'Environment', name: 'Env', config: { background: { image: 'sky.png' } } }] },
      'L',
    );
    expect(visualScene.factory.loadTexture).toHaveBeenCalledWith('sky.png');
    const env = group.getChildEntityByName<Environment2dEntity>('Env');
    expect(env.environment).toEqual({ background: 'texture:sky.png' });

    env.onSpawned(world as any);
    expect(visualScene.environment.background).toBe('texture:sky.png');
    env.onRemoved();
    expect(visualScene.environment.background).toBe(0x123456);
  });

  it('a color background needs no texture', async () => {
    const visualScene = mockScene();
    const env = new Environment2dEntity<any>({ background: 0x87ceeb });
    env.onSpawned({ visualScene } as any);
    expect(visualScene.environment.background).toBe(0x87ceeb);
    env.onRemoved();
    expect(visualScene.environment.background).toBeNull();
    expect(visualScene.factory.loadTexture).not.toHaveBeenCalled();
  });

  it('keeps a later background applied when an earlier one is removed first', () => {
    const visualScene = mockScene();
    const a = new Environment2dEntity<any>({ background: 0x00000a });
    const b = new Environment2dEntity<any>({ background: 0x00000b });
    a.onSpawned({ visualScene } as any);
    b.onSpawned({ visualScene } as any);
    a.onRemoved();
    expect(visualScene.environment.background).toBe(0x00000b);
    b.onRemoved();
    expect(visualScene.environment.background).toBeNull();
  });
});
