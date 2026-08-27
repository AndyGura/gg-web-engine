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

  describe('registerGenerator', () => {
    it('should register a generator function', () => {
      // Create a mock generator function
      const mockGenerator = jest.fn().mockReturnValue({ test: true });

      // Register the generator
      levelLoader.registerGenerator('TestEntity', mockGenerator);

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
      const entities = levelLoader.loadLevel(levelJson);

      // Verify that the generator was called with the correct arguments
      expect(entities.length).toBe(1);
      expect(mockGenerator).toHaveBeenCalledWith(world, {
        position: { x: 1, y: 2 },
        name: 'TestEntity1',
        testProperty: 'value',
      });
      expect(entities[0]).toEqual({ test: true });
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
      const entities = levelLoader.loadLevel(levelJson);

      // Verify that no entities were created and a warning was logged
      expect(entities.length).toBe(0);
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
      levelLoader.registerGenerator('Entity1', mockGenerator1);
      levelLoader.registerGenerator('Entity2', mockGenerator2);

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
      const entities = levelLoader.loadLevel(levelJson);

      // Verify that both entities were created
      expect(entities.length).toBe(2);
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
      expect(entities[0]).toEqual({ id: 1 });
      expect(entities[1]).toEqual({ id: 2 });
    });

    it('should handle empty entity list', () => {
      // Create a level JSON with no entities
      const levelJson: LevelJson = {
        entities: [],
      };

      // Load the level
      const entities = levelLoader.loadLevel(levelJson);

      // Verify that no entities were created
      expect(entities.length).toBe(0);
    });

    it('should handle null entity returned from generator', () => {
      // Create a mock generator function that returns null
      const mockGenerator = jest.fn().mockReturnValue(null);

      // Register the generator
      levelLoader.registerGenerator('NullEntity', mockGenerator);

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
      const entities = levelLoader.loadLevel(levelJson);

      // Verify that no entities were created
      expect(entities.length).toBe(0);
    });
  });

  describe('loadLevelFromUrl', () => {
    const originalFetch = global.fetch;

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('should fetch a level JSON document and load it', async () => {
      const levelJson: LevelJson = {
        entities: [{ class: 'TestEntity', position: { x: 1, y: 2 }, config: { testProperty: 'value' } }],
      };
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(levelJson),
      }) as any;

      const mockGenerator = jest.fn().mockReturnValue({ test: true });
      levelLoader.registerGenerator('TestEntity', mockGenerator);

      const entities = await levelLoader.loadLevelFromUrl('https://example.com/level.json');

      expect(global.fetch).toHaveBeenCalledWith('https://example.com/level.json');
      expect(entities.length).toBe(1);
      expect(entities[0]).toEqual({ test: true });
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
