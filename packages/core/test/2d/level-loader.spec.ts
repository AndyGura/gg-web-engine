import { Gg2dLevelLoader, Gg2dWorld, LevelJson } from '../../src';
import { mock2DBody } from '../mocks/body.mock';

describe('Gg2dLevelLoader', () => {
  let world: Gg2dWorld;
  let levelLoader: Gg2dLevelLoader;

  beforeEach(() => {
    // Create a mock world with necessary components
    world = {
      visualScene: {
        factory: {},
      },
      physicsWorld: {
        factory: {
          createTrigger: jest.fn().mockReturnValue(mock2DBody()),
        },
      },
      addPrimitiveRigidBody: jest.fn().mockReturnValue({ entity: true }),
    } as unknown as Gg2dWorld;

    // Create a level loader with the mock world
    levelLoader = new Gg2dLevelLoader(world);
  });

  describe('loadLevel', () => {
    it('should load a level with square primitives', () => {
      // Create a level JSON with a square primitive
      const levelJson: LevelJson = {
        entities: [
          {
            class: 'Primitive',
            shape: 'SQUARE',
            position: { x: 100, y: 200 },
            rotation: 0.5,
            name: 'TestSquare',
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
      levelLoader.loadLevel(levelJson);

      // Verify that the entity was created via the world's primitive helper, and reachable by name
      expect(world.addPrimitiveRigidBody).toHaveBeenCalledWith(
        {
          shape: { shape: 'SQUARE', dimensions: { x: 50, y: 50 } },
          body: {
            dynamic: true,
            mass: 1,
            restitution: 0.2,
            friction: 0.5,
            ownCollisionGroups: 'all',
            interactWithCollisionGroups: 'all',
          },
        },
        { x: 100, y: 200 },
        0.5,
        { color: 0xff0000 },
      );
      expect(levelLoader.getEntityByName('TestSquare')).toEqual({ entity: true });
    });

    it('should throw when dimensions are missing for a Square primitive', () => {
      const levelJson: LevelJson = {
        entities: [{ class: 'Primitive', shape: 'SQUARE', position: { x: 0, y: 0 } }],
      };

      expect(() => levelLoader.loadLevel(levelJson)).toThrow('Dimensions are required for SQUARE primitive');
    });

    it('should throw for an unknown primitive shape', () => {
      const levelJson: LevelJson = {
        entities: [{ class: 'Primitive', shape: 'Triangle' }],
      };

      expect(() => levelLoader.loadLevel(levelJson)).toThrow('Unknown primitive shape "Triangle"');
    });

    it('should load a level with circle primitives', () => {
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
      levelLoader.loadLevel(levelJson);

      // Verify that the entity was created via the world's primitive helper
      expect(world.addPrimitiveRigidBody).toHaveBeenCalledWith(
        {
          shape: { shape: 'CIRCLE', radius: 25 },
          body: {
            dynamic: true,
            mass: 1,
            restitution: 0.2,
            friction: 0.5,
            ownCollisionGroups: 'all',
            interactWithCollisionGroups: 'all',
          },
        },
        { x: 100, y: 200 },
        0.5,
        { color: 0x00ff00 },
      );
    });

    it('should override default body options with the ones provided', () => {
      const levelJson: LevelJson = {
        entities: [
          {
            class: 'Primitive',
            shape: 'CIRCLE',
            config: { radius: 25, body: { dynamic: false, mass: 5 } },
          },
        ],
      };

      levelLoader.loadLevel(levelJson);

      expect(world.addPrimitiveRigidBody).toHaveBeenCalledWith(
        {
          shape: { shape: 'CIRCLE', radius: 25 },
          body: {
            dynamic: false,
            mass: 5,
            restitution: 0.2,
            friction: 0.5,
            ownCollisionGroups: 'all',
            interactWithCollisionGroups: 'all',
          },
        },
        undefined,
        undefined,
        undefined,
      );
    });

    it('should load a level with triggers', () => {
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
      levelLoader.loadLevel(levelJson);

      // Verify that the trigger was created, and reachable by name
      expect(world.physicsWorld?.factory.createTrigger).toHaveBeenCalledWith(
        { shape: 'SQUARE', dimensions: { x: 50, y: 50 } },
        { position: { x: 100, y: 200 }, rotation: 0.5 },
      );
      expect(levelLoader.getEntityByName('TestTrigger')).toBeDefined();
    });
  });

  describe('registerClass', () => {
    it('should register a custom entity generator', () => {
      // Create a mock generator function
      const mockGenerator = jest.fn().mockReturnValue({ custom: true });

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
      levelLoader.loadLevel(levelJson);

      // Verify that the custom generator was called with the correct arguments, and reachable by name
      expect(mockGenerator).toHaveBeenCalledWith(world, {
        position: { x: 100, y: 200 },
        name: 'TestCustomEntity',
        customProperty: 'value',
      });
      expect(levelLoader.getEntityByName('TestCustomEntity')).toEqual({ custom: true });
    });

    it('should handle missing generators gracefully', () => {
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
      levelLoader.loadLevel(levelJson);

      // Verify that no entity was created and a warning was logged
      expect(() => levelLoader.getEntityByName('TestUnknownEntity')).toThrow(
        'No loaded entity named "TestUnknownEntity"',
      );
      expect(console.warn).toHaveBeenCalledWith('No generator registered for class alias "UnknownEntity"');

      // Restore console.warn
      console.warn = originalWarn;
    });
  });
});
