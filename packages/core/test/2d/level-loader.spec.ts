import {
  AudioSource2dEntity,
  CharacterController2dEntity,
  Entity2d,
  Gg2dLevelLoader,
  Gg2dWorld,
  IEntity,
  LevelJson,
  TickOrder,
  Trigger2dEntity,
} from '../../src';
import { mock2DBody } from '../mocks/body.mock';
import { mock2DAudioSource } from '../mocks/audio-source.mock';
import { mock2DObject } from '../mocks/object.mock';
import { mockCharacterController2d } from '../mocks/character-controller-2d.mock';

// A trivial concrete IEntity for tests that need a generator to return a real entity
class TestEntity extends IEntity {
  public readonly tickOrder = TickOrder.OBJECTS_BINDING;
}

describe('Gg2dLevelLoader', () => {
  let world: Gg2dWorld;
  let levelLoader: Gg2dLevelLoader;

  beforeEach(() => {
    // Create a mock world with necessary components
    world = {
      visualScene: {
        factory: {
          createCapsule: jest.fn().mockReturnValue(mock2DObject()),
        },
      },
      physicsWorld: {
        factory: {
          createTrigger: jest.fn().mockReturnValue(mock2DBody()),
          createCharacterController: jest.fn().mockReturnValue(mockCharacterController2d()),
        },
      },
      audioScene: {
        factory: {
          loadClip: jest.fn().mockResolvedValue('decoded-clip'),
          createSource: jest.fn().mockReturnValue(mock2DAudioSource()),
        },
      },
      addPrimitiveRigidBody: jest.fn().mockImplementation(() => new TestEntity()),
      addEntity: jest.fn(),
      removeEntity: jest.fn(),
    } as unknown as Gg2dWorld;

    // Create a level loader with the mock world
    levelLoader = new Gg2dLevelLoader(world);
  });

  describe('loadLevel', () => {
    it('should load a level with box primitives', async () => {
      // Create a level JSON with a box primitive
      const levelJson: LevelJson = {
        entities: [
          {
            class: 'Primitive',
            shape: 'BOX',
            position: { x: 100, y: 200 },
            rotation: 0.5,
            name: 'TestBox',
            config: {
              dimensions: { x: 50, y: 50 },
              material: {
                color: 0xff0000,
              },
            },
          },
        ],
      };

      // Load the level
      const level = await levelLoader.loadLevel(levelJson, 'TestLevel');

      // Verify that the entity was created via the world's primitive helper, and reachable by name
      expect(world.addPrimitiveRigidBody).toHaveBeenCalledWith(
        {
          shape: { shape: 'BOX', dimensions: { x: 50, y: 50 } },
          body: {
            bodyType: 'dynamic',
            mass: 1,
            restitution: 0.2,
            friction: 0.5,
            ownCollisionGroups: 'all',
            interactWithCollisionGroups: 'all',
            ccd: false,
          },
        },
        { x: 100, y: 200 },
        0.5,
        { color: 0xff0000 },
      );
      expect(level.getChildEntityByName('TestBox')).toBeInstanceOf(TestEntity);
    });

    it('should throw when dimensions are missing for a Box primitive', async () => {
      const levelJson: LevelJson = {
        entities: [{ class: 'Primitive', shape: 'BOX', position: { x: 0, y: 0 } }],
      };

      await expect(levelLoader.loadLevel(levelJson, 'TestLevel')).rejects.toThrow(
        'Dimensions are required for BOX primitive',
      );
    });

    it('should throw for an unknown primitive shape', async () => {
      const levelJson: LevelJson = {
        entities: [{ class: 'Primitive', shape: 'Triangle' }],
      };

      await expect(levelLoader.loadLevel(levelJson, 'TestLevel')).rejects.toThrow('Unknown primitive shape "Triangle"');
    });

    it('should load a level with circle primitives', async () => {
      // Create a level JSON with a circle primitive
      const levelJson: LevelJson = {
        entities: [
          {
            class: 'Primitive',
            shape: 'CIRCLE',
            position: { x: 100, y: 200 },
            rotation: 0.5,
            name: 'TestCircle',
            config: {
              radius: 25,
              material: {
                color: 0x00ff00,
              },
            },
          },
        ],
      };

      // Load the level
      await levelLoader.loadLevel(levelJson, 'TestLevel');

      // Verify that the entity was created via the world's primitive helper
      expect(world.addPrimitiveRigidBody).toHaveBeenCalledWith(
        {
          shape: { shape: 'CIRCLE', radius: 25 },
          body: {
            bodyType: 'dynamic',
            mass: 1,
            restitution: 0.2,
            friction: 0.5,
            ownCollisionGroups: 'all',
            interactWithCollisionGroups: 'all',
            ccd: false,
          },
        },
        { x: 100, y: 200 },
        0.5,
        { color: 0x00ff00 },
      );
    });

    it('should load a level with capsule primitives', async () => {
      const levelJson: LevelJson = {
        entities: [
          {
            class: 'Primitive',
            shape: 'CAPSULE',
            config: { radius: 10, centersDistance: 20 },
          },
        ],
      };

      await levelLoader.loadLevel(levelJson, 'TestLevel');

      expect(world.addPrimitiveRigidBody).toHaveBeenCalledWith(
        {
          shape: { shape: 'CAPSULE', radius: 10, centersDistance: 20 },
          body: {
            bodyType: 'dynamic',
            mass: 1,
            restitution: 0.2,
            friction: 0.5,
            ownCollisionGroups: 'all',
            interactWithCollisionGroups: 'all',
            ccd: false,
          },
        },
        undefined,
        undefined,
        undefined,
      );
    });

    it('should throw when centers distance is missing for a Capsule primitive', async () => {
      const levelJson: LevelJson = {
        entities: [{ class: 'Primitive', shape: 'CAPSULE', config: { radius: 10 } }],
      };

      await expect(levelLoader.loadLevel(levelJson, 'TestLevel')).rejects.toThrow(
        'Centers distance is required for CAPSULE primitive',
      );
    });

    it('should load a level with convex hull primitives', async () => {
      const vertices = [
        { x: 0, y: -15 },
        { x: 13, y: 10 },
        { x: -13, y: 10 },
      ];
      const levelJson: LevelJson = {
        entities: [{ class: 'Primitive', shape: 'CONVEX_HULL', config: { vertices } }],
      };

      await levelLoader.loadLevel(levelJson, 'TestLevel');

      expect(world.addPrimitiveRigidBody).toHaveBeenCalledWith(
        expect.objectContaining({ shape: { shape: 'CONVEX_HULL', vertices } }),
        undefined,
        undefined,
        undefined,
      );
    });

    it('should load a level with polygon primitives', async () => {
      const vertices = [
        { x: -15, y: -15 },
        { x: 0, y: -15 },
        { x: 0, y: 0 },
        { x: 15, y: 0 },
      ];
      const levelJson: LevelJson = {
        entities: [{ class: 'Primitive', shape: 'POLYGON', config: { vertices } }],
      };

      await levelLoader.loadLevel(levelJson, 'TestLevel');

      expect(world.addPrimitiveRigidBody).toHaveBeenCalledWith(
        expect.objectContaining({ shape: { shape: 'POLYGON', vertices } }),
        undefined,
        undefined,
        undefined,
      );
    });

    it('should throw when vertices are missing for a ConvexHull/Polygon primitive', async () => {
      const levelJson: LevelJson = {
        entities: [{ class: 'Primitive', shape: 'CONVEX_HULL' }],
      };

      await expect(levelLoader.loadLevel(levelJson, 'TestLevel')).rejects.toThrow(
        'Vertices are required for CONVEX_HULL primitive',
      );
    });

    it('should load a level with compound primitives, recursively building nested children', async () => {
      const levelJson: LevelJson = {
        entities: [
          {
            class: 'Primitive',
            shape: 'COMPOUND',
            config: {
              children: [
                { position: { x: -15, y: 0 }, shape: 'CIRCLE', radius: 8 },
                {
                  position: { x: 15, y: 0 },
                  rotation: 0.2,
                  shape: 'COMPOUND',
                  children: [{ shape: 'BOX', dimensions: { x: 4, y: 4 } }],
                },
              ],
            },
          },
        ],
      };

      await levelLoader.loadLevel(levelJson, 'TestLevel');

      expect(world.addPrimitiveRigidBody).toHaveBeenCalledWith(
        expect.objectContaining({
          shape: {
            shape: 'COMPOUND',
            children: [
              { position: { x: -15, y: 0 }, rotation: undefined, shape: { shape: 'CIRCLE', radius: 8 } },
              {
                position: { x: 15, y: 0 },
                rotation: 0.2,
                shape: {
                  shape: 'COMPOUND',
                  children: [
                    { position: undefined, rotation: undefined, shape: { shape: 'BOX', dimensions: { x: 4, y: 4 } } },
                  ],
                },
              },
            ],
          },
        }),
        undefined,
        undefined,
        undefined,
      );
    });

    it('should throw when children are missing for a Compound primitive', async () => {
      const levelJson: LevelJson = {
        entities: [{ class: 'Primitive', shape: 'COMPOUND' }],
      };

      await expect(levelLoader.loadLevel(levelJson, 'TestLevel')).rejects.toThrow(
        'Children are required for COMPOUND primitive',
      );
    });

    it('should override default body options with the ones provided', async () => {
      const levelJson: LevelJson = {
        entities: [
          {
            class: 'Primitive',
            shape: 'CIRCLE',
            config: { radius: 25, body: { bodyType: 'static', mass: 5 } },
          },
        ],
      };

      await levelLoader.loadLevel(levelJson, 'TestLevel');

      expect(world.addPrimitiveRigidBody).toHaveBeenCalledWith(
        {
          shape: { shape: 'CIRCLE', radius: 25 },
          body: {
            bodyType: 'static',
            mass: 5,
            restitution: 0.2,
            friction: 0.5,
            ownCollisionGroups: 'all',
            interactWithCollisionGroups: 'all',
            ccd: false,
          },
        },
        undefined,
        undefined,
        undefined,
      );
    });

    it('should load a level with triggers, wrapped ready-to-use in a Trigger2dEntity', async () => {
      // Create a level JSON with a trigger
      const levelJson: LevelJson = {
        entities: [
          {
            class: 'Trigger',
            position: { x: 100, y: 200 },
            rotation: 0.5,
            name: 'TestTrigger',
            config: {
              dimensions: { x: 50, y: 50 },
            },
          },
        ],
      };

      // Load the level
      const level = await levelLoader.loadLevel(levelJson, 'TestLevel');

      // Verify that the trigger was created, and reachable by name as a positioned entity (not
      // just the raw physics trigger component)
      expect(world.physicsWorld?.factory.createTrigger).toHaveBeenCalledWith(
        { shape: 'BOX', dimensions: { x: 50, y: 50 } },
        { position: { x: 100, y: 200 }, rotation: 0.5 },
      );
      const trigger = level.getChildEntityByName<Trigger2dEntity>('TestTrigger');
      expect(trigger).toBeInstanceOf(Trigger2dEntity);
      expect(trigger.position).toEqual({ x: 100, y: 200 });
      expect(trigger.rotation).toBe(0.5);
    });

    it('should load a level with sounds, wrapped ready-to-use in an AudioSource2dEntity parented under the level', async () => {
      const levelJson: LevelJson = {
        entities: [
          {
            class: 'Sound',
            position: { x: 100, y: 200 },
            name: 'Ambience',
            config: { path: 'assets/audio/wind.mp3', spatial: false, bus: 'ambient' },
          },
        ],
      };

      const level = await levelLoader.loadLevel(levelJson, 'TestLevel');

      expect(world.audioScene?.factory.loadClip).toHaveBeenCalledWith('assets/audio/wind.mp3');
      expect(world.audioScene?.factory.createSource).toHaveBeenCalledWith(
        expect.objectContaining({ clip: 'decoded-clip', loop: true, spatial: false, bus: 'ambient' }),
      );

      const sound = level.getChildEntityByName<AudioSource2dEntity>('Ambience');
      expect(sound).toBeInstanceOf(AudioSource2dEntity);
      expect(sound.position).toEqual({ x: 100, y: 200 });
    });

    it('should throw when a "Sound" entity has no path', async () => {
      const levelJson: LevelJson = {
        entities: [{ class: 'Sound', name: 'Ambience', config: {} }],
      };

      await expect(levelLoader.loadLevel(levelJson, 'TestLevel')).rejects.toThrow('"path" is required for Sound class');
    });

    it('should load a level with a Player, wrapped ready-to-use in a CharacterController2dEntity parented under the level', async () => {
      const levelJson: LevelJson = {
        entities: [
          {
            class: 'Player',
            position: { x: 1, y: 2 },
            name: 'TestPlayer',
            config: { radius: 0.4, centersDistance: 1.2, walkSpeed: 5 },
          },
        ],
      };

      const level = await levelLoader.loadLevel(levelJson, 'TestLevel');

      expect(world.physicsWorld?.factory.createCharacterController).toHaveBeenCalledWith(
        expect.objectContaining({ radius: 0.4, centersDistance: 1.2 }),
        { position: { x: 1, y: 2 }, rotation: undefined },
      );
      expect(world.visualScene?.factory.createCapsule).toHaveBeenCalledWith(0.4, 1.2, undefined);

      const player = level.getChildEntityByName<CharacterController2dEntity>('TestPlayer');
      expect(player).toBeInstanceOf(CharacterController2dEntity);
      expect(player.position).toEqual({ x: 1, y: 2 });
      expect(player.options.walkSpeed).toBe(5);
    });

    it("never forwards `offset`/`maxStepHeight`/`minStepWidth`/`maxSlopeClimbAngleRad`/`snapToGroundDistance` as explicit `undefined` when a Player config omits them (mirrors the 3D loader's own regression coverage for the same bug)", async () => {
      const levelJson: LevelJson = {
        entities: [
          {
            class: 'Player',
            position: { x: 0, y: 0 },
            name: 'TestPlayer',
            config: { radius: 0.4, centersDistance: 1.2 },
          },
        ],
      };

      const level = await levelLoader.loadLevel(levelJson, 'TestLevel');

      const [physicsOptions] = (world.physicsWorld?.factory.createCharacterController as jest.Mock).mock.calls[0];
      for (const key of ['offset', 'maxStepHeight', 'minStepWidth', 'maxSlopeClimbAngleRad', 'snapToGroundDistance']) {
        expect(physicsOptions).not.toHaveProperty(key);
      }

      const player = level.getChildEntityByName<CharacterController2dEntity>('TestPlayer');
      expect(player.options.maxSlopeClimbAngleRad).toBeCloseTo((50 * Math.PI) / 180);
      expect(player.options.snapToGroundDistance).toBeCloseTo(0.3);
    });

    it("forwards a Player config's `up`/`ownCollisionGroups`/`interactWithCollisionGroups` to `factory.createCharacterController` as well as to the entity", async () => {
      const levelJson: LevelJson = {
        entities: [
          {
            class: 'Player',
            position: { x: 0, y: 0 },
            name: 'TestPlayer',
            config: {
              radius: 0.4,
              centersDistance: 1.2,
              up: { x: 1, y: 0 },
              ownCollisionGroups: [2],
              interactWithCollisionGroups: [3],
            },
          },
        ],
      };

      const level = await levelLoader.loadLevel(levelJson, 'TestLevel');

      expect(world.physicsWorld?.factory.createCharacterController).toHaveBeenCalledWith(
        expect.objectContaining({
          up: { x: 1, y: 0 },
          ownCollisionGroups: [2],
          interactWithCollisionGroups: [3],
        }),
        { position: { x: 0, y: 0 }, rotation: undefined },
      );

      const player = level.getChildEntityByName<CharacterController2dEntity>('TestPlayer');
      expect(player.options.up).toEqual({ x: 1, y: 0 });
      expect(player.options.ownCollisionGroups).toEqual([2]);
      expect(player.options.interactWithCollisionGroups).toEqual([3]);
    });
  });

  describe('registerClass', () => {
    it('should register a custom entity generator', async () => {
      // Create a mock generator function returning a real entity
      const mockGenerator = jest.fn().mockImplementation(() => new TestEntity());

      // Register the generator
      levelLoader.registerClass('CustomEntity', mockGenerator);

      // Create a level JSON with a custom entity
      const levelJson: LevelJson = {
        entities: [
          {
            class: 'CustomEntity',
            position: { x: 100, y: 200 },
            name: 'TestCustomEntity',
            config: {
              customProperty: 'value',
            },
          },
        ],
      };

      // Load the level
      const level = await levelLoader.loadLevel(levelJson, 'TestLevel');

      // Verify that the custom generator was called with the correct arguments, and reachable by name
      expect(mockGenerator).toHaveBeenCalledWith(world, {
        position: { x: 100, y: 200 },
        name: 'TestCustomEntity',
        customProperty: 'value',
      });
      expect(level.getChildEntityByName('TestCustomEntity')).toBeInstanceOf(TestEntity);
    });

    it('should handle missing generators gracefully', async () => {
      // Create a level JSON with an unknown entity type
      const levelJson: LevelJson = {
        entities: [
          {
            class: 'UnknownEntity',
            position: { x: 100, y: 200 },
            name: 'TestUnknownEntity',
            config: {
              customProperty: 'value',
            },
          },
        ],
      };

      // Mock console.warn to prevent output during test
      const originalWarn = console.warn;
      console.warn = jest.fn();

      // Load the level
      const level = await levelLoader.loadLevel(levelJson, 'TestLevel');

      // Verify that no entity was created and a warning was logged
      expect(() => level.getChildEntityByName('TestUnknownEntity')).toThrow(
        'No child entity named "TestUnknownEntity"',
      );
      expect(console.warn).toHaveBeenCalledWith('No generator registered for class alias "UnknownEntity"');

      // Restore console.warn
      console.warn = originalWarn;
    });
  });

  describe('live serializers', () => {
    it("serializes a Primitive entity built directly (not via createEntity/loadLevel at all) from its live body's shape/bodyOptions/velocity", () => {
      const body = mock2DBody(
        { shape: 'CIRCLE', radius: 2 },
        {
          bodyType: 'dynamic',
          mass: 7,
          friction: 0.4,
          restitution: 0.6,
          ccd: true,
          ownCollisionGroups: [2],
          interactWithCollisionGroups: [3],
        },
      );
      body.linearVelocity = { x: 1, y: 2 };
      body.angularVelocity = 0.5;
      // Exactly what Gg2dWorld.addPrimitiveRigidBody itself constructs - not going through the
      // level loader at all.
      const entity = new Entity2d({ objectBody: body });
      entity.position = { x: 10, y: 20 };
      entity.rotation = 1.2;
      entity.name = 'DirectPrimitive';

      expect(levelLoader.serializeEntity(entity)).toEqual({
        class: 'Primitive',
        shape: 'CIRCLE',
        name: 'DirectPrimitive',
        position: { x: 10, y: 20 },
        rotation: 1.2,
        config: {
          radius: 2,
          body: body.bodyOptions,
          linearVelocity: { x: 1, y: 2 },
          angularVelocity: 0.5,
        },
      });
    });

    it('recovers material from object2D when it implements IMaterialReadable2dComponent', () => {
      const body = mock2DBody({ shape: 'BOX', dimensions: { x: 1, y: 1 } });
      const object2D = { ...mock2DObject(), materialOptions: { color: 8947848 } };
      const entity = new Entity2d({ objectBody: body, object2D: object2D as any });
      entity.name = 'MaterialPrimitive';

      const json = levelLoader.serializeEntity(entity)!;
      expect(json.config.material).toEqual({ color: 8947848 });
    });

    it('omits material for a display object with no IMaterialReadable2dComponent capability', () => {
      const body = mock2DBody({ shape: 'BOX', dimensions: { x: 1, y: 1 } });
      const entity = new Entity2d({ objectBody: body, object2D: mock2DObject() });
      entity.name = 'NoMaterialPrimitive';

      const json = levelLoader.serializeEntity(entity)!;
      expect(json.config.material).toBeUndefined();
    });

    it('serializes a Trigger entity from its live body, regardless of how it was built', () => {
      const trigger = new Trigger2dEntity(mock2DBody({ shape: 'BOX', dimensions: { x: 4, y: 5 } }) as any);
      trigger.position = { x: 1, y: 2 };
      trigger.rotation = 0.3;
      trigger.name = 'DirectTrigger';

      expect(levelLoader.serializeEntity(trigger)).toEqual({
        class: 'Trigger',
        name: 'DirectTrigger',
        position: { x: 1, y: 2 },
        rotation: 0.3,
        config: { dimensions: { x: 4, y: 5 } },
      });
    });

    it('serializes a Player built via createEntity with class "Player" (spawn-record echo - CharacterController2dEntity has no live/self-serializer)', async () => {
      const character = await levelLoader.createEntity({
        class: 'Player',
        name: 'DirectPlayer',
        position: { x: 3, y: 4 },
        config: { radius: 0.4, centersDistance: 1.0 },
      });

      expect(character).toBeInstanceOf(CharacterController2dEntity);
      expect(levelLoader.serializeEntity(character!)).toEqual({
        class: 'Player',
        name: 'DirectPlayer',
        position: { x: 3, y: 4 },
        rotation: 0,
        config: { radius: 0.4, centersDistance: 1.0 },
      });
    });

    it('falls through to the spawn-record echo for an entity the live serializers do not recognize', async () => {
      levelLoader.registerClass('Custom', () => new TestEntity());

      const level = await levelLoader.loadLevel(
        { entities: [{ class: 'Custom', name: 'CustomOne', config: { foo: 'bar' } }] },
        'FallbackLevel',
      );
      const entity = level.getChildEntityByName<TestEntity>('CustomOne');

      expect(levelLoader.serializeEntity(entity as any)).toEqual({
        class: 'Custom',
        name: 'CustomOne',
        config: { foo: 'bar' },
      });
    });
  });
});
