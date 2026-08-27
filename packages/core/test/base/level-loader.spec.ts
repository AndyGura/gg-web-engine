import { GgWorld, LevelJson, LevelLoader, Point2 } from '../../src';
import { MockWorld } from '../mocks/world.mock';

// Create a concrete implementation of LevelLoader for testing
class TestLevelLoader extends LevelLoader<Point2, number, any> {}

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
    it('should register a generator function', () => {
      // Create a mock generator function
      const mockGenerator = jest.fn().mockReturnValue({ test: true });

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
      levelLoader.loadLevel(levelJson);

      // Verify that the generator was called with the correct arguments, and its result is
      // reachable by the entity's name
      expect(mockGenerator).toHaveBeenCalledWith(world, {
        position: { x: 1, y: 2 },
        name: 'TestEntity1',
        testProperty: 'value',
      });
      expect(levelLoader.getEntityByName('TestEntity1')).toEqual({ test: true });
    });

    it('should merge shape into the settings passed to the generator', () => {
      // Create a mock generator function
      const mockGenerator = jest.fn().mockReturnValue({ test: true });

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
      levelLoader.loadLevel(levelJson);

      // Verify that shape was folded into the settings alongside position/config
      expect(mockGenerator).toHaveBeenCalledWith(world, {
        shape: 'SQUARE',
        position: { x: 1, y: 2 },
        dimensions: { x: 10, y: 10 },
      });
    });

    it('should handle missing generators gracefully', () => {
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
      levelLoader.loadLevel(levelJson);

      // Verify that no entity was created and a warning was logged
      expect(() => levelLoader.getEntityByName('UnknownEntity1')).toThrow(
        'No loaded entity named "UnknownEntity1"',
      );
      expect(console.warn).toHaveBeenCalledWith('No generator registered for class alias "UnknownEntity"');

      // Restore console.warn
      console.warn = originalWarn;
    });
  });

  describe('loadLevel', () => {
    it('should load a level with multiple entities', () => {
      // Create mock generator functions
      const mockGenerator1 = jest.fn().mockReturnValue({ id: 1 });
      const mockGenerator2 = jest.fn().mockReturnValue({ id: 2 });

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
      levelLoader.loadLevel(levelJson);

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
      expect(levelLoader.getEntityByName('Entity1')).toEqual({ id: 1 });
      expect(levelLoader.getEntityByName('Entity2')).toEqual({ id: 2 });
    });

    it('should handle empty entity list', () => {
      // Create a level JSON with no entities
      const levelJson: LevelJson = {
        entities: [],
      };

      // Load the level - should not throw
      expect(() => levelLoader.loadLevel(levelJson)).not.toThrow();
    });

    it('should handle null entity returned from generator', () => {
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
      levelLoader.loadLevel(levelJson);

      // Verify that no entity was registered under that name
      expect(() => levelLoader.getEntityByName('NullEntity1')).toThrow('No loaded entity named "NullEntity1"');
    });
  });

  describe('getEntityByName', () => {
    it('should throw for a name that was never loaded', () => {
      expect(() => levelLoader.getEntityByName('Nope')).toThrow('No loaded entity named "Nope"');
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

      const mockGenerator = jest.fn().mockReturnValue({ test: true });
      levelLoader.registerClass('TestEntity', mockGenerator);

      await levelLoader.loadLevelFromUrl('https://example.com/level.json');

      expect(global.fetch).toHaveBeenCalledWith('https://example.com/level.json');
      expect(levelLoader.getEntityByName('TestEntity1')).toEqual({ test: true });
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
