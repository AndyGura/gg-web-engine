import { Gg3dLevelLoader, Gg3dWorld, LevelJson } from '../../src';
import { mock3DBody } from '../mocks/body.mock';
import { mock3DObject } from '../mocks/object.mock';

const defaultBody = {
  dynamic: true,
  mass: 1,
  restitution: 0.2,
  friction: 0.5,
  ownCollisionGroups: 'all',
  interactWithCollisionGroups: 'all',
};

describe('Gg3dLevelLoader', () => {
  let world: Gg3dWorld;
  let levelLoader: Gg3dLevelLoader;

  beforeEach(() => {
    // Create a mock world with necessary components
    world = {
      visualScene: {
        factory: {
          createPerspectiveCamera: jest.fn().mockReturnValue(mock3DObject()),
        },
      },
      physicsWorld: {
        factory: {
          createTrigger: jest.fn().mockReturnValue(mock3DBody()),
        },
      },
      addPrimitiveRigidBody: jest.fn().mockReturnValue({ entity: true }),
    } as unknown as Gg3dWorld;

    // Create a level loader with the mock world
    levelLoader = new Gg3dLevelLoader(world);
  });

  describe('loadLevel', () => {
    it('should load a level with box primitives', () => {
      // Create a level JSON with a box primitive
      const levelJson: LevelJson = {
        entities: [
          {
            class: 'Box',
            position: { x: 1, y: 2, z: 3 },
            rotation: { x: 0, y: 0, z: 0, w: 1 },
            name: 'TestBox',
            config: {
              dimensions: { x: 1, y: 1, z: 1 },
              material: {
                color: 0xff0000,
              },
            },
          },
        ],
      };

      // Load the level
      const entities = levelLoader.loadLevel(levelJson);

      // Verify that the entity was created via the world's primitive helper
      expect(entities.length).toBe(1);
      expect(world.addPrimitiveRigidBody).toHaveBeenCalledWith(
        { shape: { shape: 'BOX', dimensions: { x: 1, y: 1, z: 1 } }, body: defaultBody },
        { x: 1, y: 2, z: 3 },
        { x: 0, y: 0, z: 0, w: 1 },
        { color: 0xff0000 },
      );
      expect(entities[0]).toEqual({ entity: true });
    });

    it('should throw when dimensions are missing for a Box primitive', () => {
      const levelJson: LevelJson = { entities: [{ class: 'Box' }] };
      expect(() => levelLoader.loadLevel(levelJson)).toThrow('Dimensions are required for Box primitive');
    });

    it('should load a level with sphere primitives', () => {
      const levelJson: LevelJson = {
        entities: [{ class: 'Sphere', config: { radius: 0.5 } }],
      };

      levelLoader.loadLevel(levelJson);

      expect(world.addPrimitiveRigidBody).toHaveBeenCalledWith(
        { shape: { shape: 'SPHERE', radius: 0.5 }, body: defaultBody },
        undefined,
        undefined,
        undefined,
      );
    });

    it('should load a level with plane primitives', () => {
      const levelJson: LevelJson = { entities: [{ class: 'Plane' }] };

      levelLoader.loadLevel(levelJson);

      expect(world.addPrimitiveRigidBody).toHaveBeenCalledWith(
        { shape: { shape: 'PLANE' }, body: defaultBody },
        undefined,
        undefined,
        undefined,
      );
    });

    it('should load a level with capsule primitives', () => {
      const levelJson: LevelJson = {
        entities: [{ class: 'Capsule', config: { radius: 0.5, centersDistance: 1 } }],
      };

      levelLoader.loadLevel(levelJson);

      expect(world.addPrimitiveRigidBody).toHaveBeenCalledWith(
        { shape: { shape: 'CAPSULE', radius: 0.5, centersDistance: 1 }, body: defaultBody },
        undefined,
        undefined,
        undefined,
      );
    });

    it('should load a level with cylinder primitives', () => {
      const levelJson: LevelJson = {
        entities: [{ class: 'Cylinder', config: { radius: 0.5, height: 2 } }],
      };

      levelLoader.loadLevel(levelJson);

      expect(world.addPrimitiveRigidBody).toHaveBeenCalledWith(
        { shape: { shape: 'CYLINDER', radius: 0.5, height: 2 }, body: defaultBody },
        undefined,
        undefined,
        undefined,
      );
    });

    it('should load a level with cone primitives', () => {
      const levelJson: LevelJson = {
        entities: [{ class: 'Cone', config: { radius: 0.5, height: 2 } }],
      };

      levelLoader.loadLevel(levelJson);

      expect(world.addPrimitiveRigidBody).toHaveBeenCalledWith(
        { shape: { shape: 'CONE', radius: 0.5, height: 2 }, body: defaultBody },
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
            position: { x: 1, y: 2, z: 3 },
            rotation: { x: 0, y: 0, z: 0, w: 1 },
            name: 'TestTrigger',
            config: {
              dimensions: { x: 1, y: 1, z: 1 },
            },
          },
        ],
      };

      // Load the level
      const entities = levelLoader.loadLevel(levelJson);

      // Verify that the trigger was created
      expect(entities.length).toBe(1);
      expect(world.physicsWorld?.factory.createTrigger).toHaveBeenCalledWith(
        { shape: 'BOX', dimensions: { x: 1, y: 1, z: 1 } },
        { position: { x: 1, y: 2, z: 3 }, rotation: { x: 0, y: 0, z: 0, w: 1 } },
      );
    });

    it('should load a level with cameras', () => {
      // Create a level JSON with a camera
      const levelJson: LevelJson = {
        entities: [
          {
            class: 'Camera',
            position: { x: 1, y: 2, z: 3 },
            rotation: { x: 0, y: 0, z: 0, w: 1 },
            name: 'TestCamera',
            config: {
              fov: 75,
              aspectRatio: 16 / 9,
              frustrum: { near: 0.1, far: 1000 },
            },
          },
        ],
      };

      // Load the level
      const entities = levelLoader.loadLevel(levelJson);

      // Verify that the camera was created
      expect(entities.length).toBe(1);
      expect(world.visualScene?.factory.createPerspectiveCamera).toHaveBeenCalledWith({
        fov: 75,
        aspectRatio: 16 / 9,
        frustrum: { near: 0.1, far: 1000 },
      });
      expect(entities[0].position).toEqual({ x: 1, y: 2, z: 3 });
      expect(entities[0].rotation).toEqual({ x: 0, y: 0, z: 0, w: 1 });
    });
  });

  describe('registerGenerator', () => {
    it('should register a custom entity generator', () => {
      // Create a mock generator function
      const mockGenerator = jest.fn().mockReturnValue({ custom: true });

      // Register the generator
      levelLoader.registerGenerator('CustomEntity', mockGenerator);

      // Create a level JSON with a custom entity
      const levelJson: LevelJson = {
        entities: [
          {
            class: 'CustomEntity',
            position: { x: 1, y: 2, z: 3 },
            name: 'TestCustomEntity',
            config: {
              customProperty: 'value',
            },
          },
        ],
      };

      // Load the level
      const entities = levelLoader.loadLevel(levelJson);

      // Verify that the custom generator was called with the correct arguments
      expect(entities.length).toBe(1);
      expect(mockGenerator).toHaveBeenCalledWith(world, {
        position: { x: 1, y: 2, z: 3 },
        name: 'TestCustomEntity',
        customProperty: 'value',
      });
      expect(entities[0]).toEqual({ custom: true });
    });

    it('should handle missing generators gracefully', () => {
      // Create a level JSON with an unknown entity type
      const levelJson: LevelJson = {
        entities: [
          {
            class: 'UnknownEntity',
            position: { x: 1, y: 2, z: 3 },
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
      const entities = levelLoader.loadLevel(levelJson);

      // Verify that no entities were created and a warning was logged
      expect(entities.length).toBe(0);
      expect(console.warn).toHaveBeenCalledWith('No generator registered for class alias "UnknownEntity"');

      // Restore console.warn
      console.warn = originalWarn;
    });
  });
});
