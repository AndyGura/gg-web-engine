import { GgWorld, GroupEntity, IEntity, LevelJson, LevelLoader, Point2, TickOrder } from '../../src';
import { MockWorld } from '../mocks/world.mock';

// Create a concrete implementation of LevelLoader for testing
class TestLevelLoader extends LevelLoader<Point2, number, any> {}

// A trivial concrete IEntity for tests that need a generator to return a real entity
class TestEntity extends IEntity {
  public readonly tickOrder = TickOrder.OBJECTS_BINDING;
}

describe('LevelLoader', () => {
  let world: GgWorld<any, any>;
  let levelLoader: TestLevelLoader;

  beforeEach(() => {
    // Create a mock world
    world = new MockWorld();

    // Create a level loader with the mock world
    levelLoader = new TestLevelLoader(world);
  });

  describe('registerClass', () => {
    it('should register a generator function', async () => {
      // Create a mock generator function returning a real entity
      const mockGenerator = jest.fn().mockImplementation(() => new TestEntity());

      // Register the generator
      levelLoader.registerClass('TestEntity', mockGenerator);

      // Create a level JSON with the test entity
      const levelJson: LevelJson = {
        entities: [
          {
            class: 'TestEntity',
            position: { x: 1, y: 2 },
            name: 'TestEntity1',
            config: {
              testProperty: 'value',
            },
          },
        ],
      };

      // Load the level
      await levelLoader.loadLevel(levelJson);

      // Verify that the generator was called with the correct arguments, and its result is named
      // and reachable through the world
      expect(mockGenerator).toHaveBeenCalledWith(world, {
        position: { x: 1, y: 2 },
        name: 'TestEntity1',
        testProperty: 'value',
      });
      const entity = world.getEntityByName('TestEntity1');
      expect(entity).toBeInstanceOf(TestEntity);
      expect(entity.name).toBe('TestEntity1');
    });

    it('should merge shape into the settings passed to the generator', async () => {
      // Create a mock generator function
      const mockGenerator = jest.fn().mockReturnValue(new TestEntity());

      // Register the generator
      levelLoader.registerClass('Primitive', mockGenerator);

      // Create a level JSON with a "Primitive" entity carrying a shape
      const levelJson: LevelJson = {
        entities: [
          {
            class: 'Primitive',
            shape: 'SQUARE',
            position: { x: 1, y: 2 },
            config: {
              dimensions: { x: 10, y: 10 },
            },
          },
        ],
      };

      // Load the level
      await levelLoader.loadLevel(levelJson);

      // Verify that shape was folded into the settings alongside position/config
      expect(mockGenerator).toHaveBeenCalledWith(world, {
        shape: 'SQUARE',
        position: { x: 1, y: 2 },
        dimensions: { x: 10, y: 10 },
      });
    });

    it('should handle missing generators gracefully', async () => {
      // Create a level JSON with an unknown entity type
      const levelJson: LevelJson = {
        entities: [
          {
            class: 'UnknownEntity',
            position: { x: 1, y: 2 },
            name: 'UnknownEntity1',
            config: {
              testProperty: 'value',
            },
          },
        ],
      };

      // Mock console.warn to prevent output during test
      const originalWarn = console.warn;
      console.warn = jest.fn();

      // Load the level
      await levelLoader.loadLevel(levelJson);

      // Verify that no entity was created and a warning was logged
      expect(() => world.getEntityByName('UnknownEntity1')).toThrow(
        'No entity named "UnknownEntity1" found in the world',
      );
      expect(console.warn).toHaveBeenCalledWith('No generator registered for class alias "UnknownEntity"');

      // Restore console.warn
      console.warn = originalWarn;
    });
  });

  describe('loadLevel', () => {
    it('should load a level with multiple entities', async () => {
      // Create mock generator functions
      const mockGenerator1 = jest.fn().mockImplementation(() => new TestEntity());
      const mockGenerator2 = jest.fn().mockImplementation(() => new TestEntity());

      // Register the generators
      levelLoader.registerClass('Entity1', mockGenerator1);
      levelLoader.registerClass('Entity2', mockGenerator2);

      // Create a level JSON with multiple entities
      const levelJson: LevelJson = {
        entities: [
          {
            class: 'Entity1',
            position: { x: 1, y: 2 },
            name: 'Entity1',
            config: {
              property1: 'value1',
            },
          },
          {
            class: 'Entity2',
            position: { x: 3, y: 4 },
            name: 'Entity2',
            config: {
              property2: 'value2',
            },
          },
        ],
      };

      // Load the level
      await levelLoader.loadLevel(levelJson);

      // Verify that both entities were created and are reachable by name
      expect(mockGenerator1).toHaveBeenCalledWith(world, {
        position: { x: 1, y: 2 },
        name: 'Entity1',
        property1: 'value1',
      });
      expect(mockGenerator2).toHaveBeenCalledWith(world, {
        position: { x: 3, y: 4 },
        name: 'Entity2',
        property2: 'value2',
      });
      expect(world.getEntityByName('Entity1')).toBeInstanceOf(TestEntity);
      expect(world.getEntityByName('Entity2')).toBeInstanceOf(TestEntity);
    });

    it('should handle empty entity list', async () => {
      // Create a level JSON with no entities
      const levelJson: LevelJson = {
        entities: [],
      };

      // Load the level - should not throw
      await expect(levelLoader.loadLevel(levelJson)).resolves.not.toThrow();
    });

    it('should handle null entity returned from generator', async () => {
      // Create a mock generator function that returns null
      const mockGenerator = jest.fn().mockReturnValue(null);

      // Register the generator
      levelLoader.registerClass('NullEntity', mockGenerator);

      // Create a level JSON with the null entity
      const levelJson: LevelJson = {
        entities: [
          {
            class: 'NullEntity',
            position: { x: 1, y: 2 },
            name: 'NullEntity1',
            config: {
              testProperty: 'value',
            },
          },
        ],
      };

      // Load the level
      await levelLoader.loadLevel(levelJson);

      // Verify that no entity was registered under that name
      expect(() => world.getEntityByName('NullEntity1')).toThrow('No entity named "NullEntity1" found in the world');
    });

    it('should return a group entity, already added to the world, wrapping the level', async () => {
      levelLoader.registerClass('TestEntity', () => new TestEntity());

      const level = await levelLoader.loadLevel({
        entities: [{ class: 'TestEntity', name: 'Child' }],
      });

      expect(level).toBeInstanceOf(GroupEntity);
      expect(level.world).toBe(world);
    });

    it('should name the group entity when a levelName is given, and make it reachable by name', async () => {
      const level = await levelLoader.loadLevel({ entities: [] }, 'MyLevel');

      expect(level.name).toBe('MyLevel');
      expect(world.getEntityByName('MyLevel')).toBe(level);
    });

    it('should parent IEntity results under the group entity; non-entity results are untracked', async () => {
      levelLoader.registerClass('RealEntity', () => new TestEntity());
      levelLoader.registerClass('PlainObject', () => ({ plain: true }));

      const level = await levelLoader.loadLevel({
        entities: [
          { class: 'RealEntity', name: 'Real' },
          { class: 'PlainObject', name: 'Plain' },
        ],
      });

      expect(level.children).toEqual([level.getChildEntityByName('Real')]);
      expect(() => level.getChildEntityByName('Plain')).toThrow('No child entity named "Plain"');
      expect(() => world.getEntityByName('Plain')).toThrow('No entity named "Plain" found in the world');
    });

    it('should reparent an entity that already self-added to the world (e.g. via addPrimitiveRigidBody) without warning or double-adding it', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      levelLoader.registerClass('SelfAdding', () => {
        const entity = new TestEntity();
        world.addEntity(entity); // mimics what Gg2dWorld/Gg3dWorld.addPrimitiveRigidBody does
        return entity;
      });

      const level = await levelLoader.loadLevel({
        entities: [{ class: 'SelfAdding', name: 'SelfAdded' }],
      });
      const entity = world.getEntityByName('SelfAdded');

      // Reparented under the level, present in world.children exactly once, no spurious warning
      expect(level.children).toEqual([entity]);
      expect(entity.parent).toBe(level);
      expect(world.children.filter(e => e === entity).length).toBe(1);
      expect(warnSpy).not.toHaveBeenCalled();

      warnSpy.mockRestore();
    });

    it('should tear down the group entity if a generator throws partway through', async () => {
      let created: TestEntity | undefined;
      levelLoader.registerClass('RealEntity', () => (created = new TestEntity()));
      levelLoader.registerClass('Bad', () => {
        throw new Error('boom');
      });

      await expect(
        levelLoader.loadLevel({
          entities: [
            { class: 'RealEntity', name: 'Real' },
            { class: 'Bad' },
          ],
        }),
      ).rejects.toThrow('boom');

      // The entity created before the throw was torn down along with the level, and is no longer
      // reachable from the world at all
      expect(created!.world).toBeNull();
      expect(() => world.getEntityByName('Real')).toThrow('No entity named "Real" found in the world');
    });
  });

  describe('loadLevelFromUrl', () => {
    const originalFetch = global.fetch;

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('should fetch a level JSON document and load it', async () => {
      const levelJson: LevelJson = {
        entities: [
          { class: 'TestEntity', position: { x: 1, y: 2 }, name: 'TestEntity1', config: { testProperty: 'value' } },
        ],
      };
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(levelJson),
      }) as any;

      const mockGenerator = jest.fn().mockImplementation(() => new TestEntity());
      levelLoader.registerClass('TestEntity', mockGenerator);

      await levelLoader.loadLevelFromUrl('https://example.com/level.json');

      expect(global.fetch).toHaveBeenCalledWith('https://example.com/level.json');
      expect(world.getEntityByName('TestEntity1')).toBeInstanceOf(TestEntity);
    });

    it('should throw if the response is not ok', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      }) as any;

      await expect(levelLoader.loadLevelFromUrl('https://example.com/missing.json')).rejects.toThrow(
        'Failed to load level JSON from "https://example.com/missing.json": 404 Not Found',
      );
    });
  });
});
