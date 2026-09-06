import {
  Camera3dEntity,
  Gg3dLevelLoader,
  Gg3dWorld,
  GgCarEntity,
  IEntity,
  LevelJson,
  MapGraph3dEntity,
  RVEntityTractionBias,
  TickOrder,
  Trigger3dEntity,
} from '../../src';
import { mock3DBody } from '../mocks/body.mock';
import { mock3DObject } from '../mocks/object.mock';
import { mockRaycastVehicle } from '../mocks/raycast-vehicle.mock';

const defaultBody = {
  dynamic: true,
  mass: 1,
  restitution: 0.2,
  friction: 0.5,
  ownCollisionGroups: 'all',
  interactWithCollisionGroups: 'all',
};

// A trivial concrete IEntity for tests that need a generator to return a real entity
class TestEntity extends IEntity {
  public readonly tickOrder = TickOrder.OBJECTS_BINDING;
}

describe('Gg3dLevelLoader', () => {
  let world: Gg3dWorld;
  let levelLoader: Gg3dLevelLoader;

  beforeEach(() => {
    // Create a mock world with necessary components
    world = {
      visualScene: {
        factory: {
          createPerspectiveCamera: jest.fn().mockReturnValue(mock3DObject()),
          createBox: jest.fn().mockReturnValue(mock3DObject()),
          createCylinder: jest.fn().mockReturnValue(mock3DObject()),
        },
      },
      physicsWorld: {
        factory: {
          createTrigger: jest.fn().mockReturnValue(mock3DBody()),
          createRigidBody: jest.fn().mockReturnValue(mock3DBody()),
          createRaycastVehicle: jest.fn().mockReturnValue(mockRaycastVehicle()),
        },
      },
      addPrimitiveRigidBody: jest.fn().mockImplementation(() => new TestEntity()),
      addEntity: jest.fn(),
      removeEntity: jest.fn(),
    } as unknown as Gg3dWorld;

    // Create a level loader with the mock world
    levelLoader = new Gg3dLevelLoader(world);
  });

  describe('loadLevel', () => {
    it('should load a level with box primitives', async () => {
      // Create a level JSON with a box primitive
      const levelJson: LevelJson = {
        entities: [
          {
            class: 'Primitive',
            shape: 'BOX',
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
      const level = await levelLoader.loadLevel(levelJson);

      // Verify that the entity was created via the world's primitive helper, and reachable by name
      expect(world.addPrimitiveRigidBody).toHaveBeenCalledWith(
        { shape: { shape: 'BOX', dimensions: { x: 1, y: 1, z: 1 } }, body: defaultBody },
        { x: 1, y: 2, z: 3 },
        { x: 0, y: 0, z: 0, w: 1 },
        { color: 0xff0000 },
      );
      expect(level.getChildEntityByName('TestBox')).toBeInstanceOf(TestEntity);
    });

    it('should throw when dimensions are missing for a Box primitive', async () => {
      const levelJson: LevelJson = { entities: [{ class: 'Primitive', shape: 'BOX' }] };
      await expect(levelLoader.loadLevel(levelJson)).rejects.toThrow('Dimensions are required for BOX primitive');
    });

    it('should throw for an unknown primitive shape', async () => {
      const levelJson: LevelJson = { entities: [{ class: 'Primitive', shape: 'Torus' }] };
      await expect(levelLoader.loadLevel(levelJson)).rejects.toThrow('Unknown primitive shape "Torus"');
    });

    it('should load a level with sphere primitives', async () => {
      const levelJson: LevelJson = {
        entities: [{ class: 'Primitive', shape: 'SPHERE', config: { radius: 0.5 } }],
      };

      await levelLoader.loadLevel(levelJson);

      expect(world.addPrimitiveRigidBody).toHaveBeenCalledWith(
        { shape: { shape: 'SPHERE', radius: 0.5 }, body: defaultBody },
        undefined,
        undefined,
        undefined,
      );
    });

    it('should load a level with plane primitives', async () => {
      const levelJson: LevelJson = { entities: [{ class: 'Primitive', shape: 'PLANE' }] };

      await levelLoader.loadLevel(levelJson);

      expect(world.addPrimitiveRigidBody).toHaveBeenCalledWith(
        { shape: { shape: 'PLANE' }, body: defaultBody },
        undefined,
        undefined,
        undefined,
      );
    });

    it('should load a level with capsule primitives', async () => {
      const levelJson: LevelJson = {
        entities: [{ class: 'Primitive', shape: 'CAPSULE', config: { radius: 0.5, centersDistance: 1 } }],
      };

      await levelLoader.loadLevel(levelJson);

      expect(world.addPrimitiveRigidBody).toHaveBeenCalledWith(
        { shape: { shape: 'CAPSULE', radius: 0.5, centersDistance: 1 }, body: defaultBody },
        undefined,
        undefined,
        undefined,
      );
    });

    it('should load a level with cylinder primitives', async () => {
      const levelJson: LevelJson = {
        entities: [{ class: 'Primitive', shape: 'CYLINDER', config: { radius: 0.5, height: 2 } }],
      };

      await levelLoader.loadLevel(levelJson);

      expect(world.addPrimitiveRigidBody).toHaveBeenCalledWith(
        { shape: { shape: 'CYLINDER', radius: 0.5, height: 2 }, body: defaultBody },
        undefined,
        undefined,
        undefined,
      );
    });

    it('should load a level with cone primitives', async () => {
      const levelJson: LevelJson = {
        entities: [{ class: 'Primitive', shape: 'CONE', config: { radius: 0.5, height: 2 } }],
      };

      await levelLoader.loadLevel(levelJson);

      expect(world.addPrimitiveRigidBody).toHaveBeenCalledWith(
        { shape: { shape: 'CONE', radius: 0.5, height: 2 }, body: defaultBody },
        undefined,
        undefined,
        undefined,
      );
    });

    it('should load a level with triggers, wrapped ready-to-use in a Trigger3dEntity', async () => {
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
      const level = await levelLoader.loadLevel(levelJson);

      // Verify that the trigger was created, and reachable by name as a positioned entity (not
      // just the raw physics trigger component)
      expect(world.physicsWorld?.factory.createTrigger).toHaveBeenCalledWith(
        { shape: 'BOX', dimensions: { x: 1, y: 1, z: 1 } },
        { position: { x: 1, y: 2, z: 3 }, rotation: { x: 0, y: 0, z: 0, w: 1 } },
      );
      const trigger = level.getChildEntityByName<Trigger3dEntity>('TestTrigger');
      expect(trigger).toBeInstanceOf(Trigger3dEntity);
      expect(trigger.position).toEqual({ x: 1, y: 2, z: 3 });
      expect(trigger.rotation).toEqual({ x: 0, y: 0, z: 0, w: 1 });
    });

    it('should load a level with cameras, wrapped ready-to-use in a Camera3dEntity parented under the level', async () => {
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
      const level = await levelLoader.loadLevel(levelJson);

      // Verify that the camera was created
      expect(world.visualScene?.factory.createPerspectiveCamera).toHaveBeenCalledWith({
        fov: 75,
        aspectRatio: 16 / 9,
        frustrum: { near: 0.1, far: 1000 },
      });

      // The camera entity is parented under the level's group entity, so it's torn down along
      // with the rest of the level.
      const cameraEntity = level.getChildEntityByName<Camera3dEntity>('TestCamera');
      expect(cameraEntity).toBeInstanceOf(Camera3dEntity);
      expect(cameraEntity.position).toEqual({ x: 1, y: 2, z: 3 });
      expect(cameraEntity.rotation).toEqual({ x: 0, y: 0, z: 0, w: 1 });
    });

    // Common car fields shared by both wheelBase- and wheelOptions-based GgCar tests
    const carCommonConfig = {
      suspension: { stiffness: 20, damping: 2.3, compression: 4.4, restLength: 0.53 },
      tractionBias: RVEntityTractionBias.RWD,
      engine: {
        minRpm: 700,
        maxRpm: 7000,
        torques: [{ rpm: 1000, torque: 270 }, { rpm: 7000, torque: 430 }],
        maxRpmIncreasePerSecond: 8000,
        maxRpmDecreasePerSecond: 8000,
      },
      brake: { frontAxleForce: 350, rearAxleForce: 300, handbrakeForce: 1500 },
      transmission: {
        isAuto: false,
        drivelineEfficiency: 0.85,
        finalDriveRatio: 3.21,
        reverseGearRatio: -2.33,
        gearRatios: [2.92, 1.87, 1.42, 1.09, 0.81],
        upShifts: [7140, 7140, 7140, 7140, 7140],
        autoHold: false,
      },
      maxSteerAngle: 0.35,
    };

    it('should load a level with a GgCar built from a wheelBase', async () => {
      const levelJson: LevelJson = {
        entities: [
          {
            class: 'GgCar',
            position: { x: 1, y: 2, z: 3 },
            rotation: { x: 0, y: 0, z: 0, w: 1 },
            name: 'TestCar',
            config: {
              ...carCommonConfig,
              chassis: { dimensions: { x: 1.8, y: 4, z: 0.6 }, material: { color: 0x990000 }, body: { mass: 900 } },
              wheelBase: {
                shared: { frictionSlip: 1000, rollInfluence: 0.2, display: { wheelObjectDirection: 'z' } },
                front: { halfAxleWidth: 1, axlePosition: 1.7, axleHeight: 0.3, tyreRadius: 0.35, tyreWidth: 0.2 },
                rear: {
                  halfAxleWidth: 1,
                  axlePosition: -1,
                  axleHeight: 0.3,
                  tyreRadius: 0.4,
                  tyreWidth: 0.3,
                  display: { material: { color: 0x111111 } },
                },
              },
            },
          },
        ],
      };

      const level = await levelLoader.loadLevel(levelJson);

      // Chassis rigid body created from the box shape, body options merged over the (heavier
      // than a default primitive's) car chassis defaults
      expect(world.physicsWorld?.factory.createRigidBody).toHaveBeenCalledWith({
        shape: { shape: 'BOX', dimensions: { x: 1.8, y: 4, z: 0.6 } },
        body: { ...defaultBody, mass: 900 },
      });
      // Chassis display box created to match
      expect(world.visualScene?.factory.createBox).toHaveBeenCalledWith(
        { x: 1.8, y: 4, z: 0.6 },
        { color: 0x990000 },
      );
      // The raycast vehicle wraps the chassis body that was just created
      expect(world.physicsWorld?.factory.createRaycastVehicle).toHaveBeenCalledWith(
        (world.physicsWorld?.factory.createRigidBody as jest.Mock).mock.results[0].value,
      );
      // Both wheels get a display - the front inherits "display" from "shared" (only overriding
      // its own tyre size/material), the rear overrides it with its own material
      expect(world.visualScene?.factory.createCylinder).toHaveBeenCalledTimes(2);
      expect(world.visualScene?.factory.createCylinder).toHaveBeenCalledWith(0.35, 0.2, {});
      expect(world.visualScene?.factory.createCylinder).toHaveBeenCalledWith(0.4, 0.3, { color: 0x111111 });

      const car = level.getChildEntityByName<GgCarEntity>('TestCar');
      expect(car).toBeInstanceOf(GgCarEntity);
      expect(car.position).toEqual({ x: 1, y: 2, z: 3 });
      expect(car.rotation).toEqual({ x: 0, y: 0, z: 0, w: 1 });
      expect(car.carProperties.maxSteerAngle).toBe(0.35);
    });

    it('should load a level with a GgCar built from wheelOptions', async () => {
      const levelJson: LevelJson = {
        entities: [
          {
            class: 'GgCar',
            name: 'TestCar2',
            config: {
              ...carCommonConfig,
              chassis: { dimensions: { x: 1.6, y: 3.6, z: 0.5 } },
              sharedWheelOptions: { tyreRadius: 0.3, tyreWidth: 0.25, display: { wheelObjectDirection: 'x' } },
              wheelOptions: [
                { isFront: true, isLeft: true, position: { x: 0.8, y: 1.5, z: 0.3 } },
                { isFront: true, isLeft: false, position: { x: -0.8, y: 1.5, z: 0.3 } },
                { isFront: false, isLeft: true, position: { x: 0.8, y: -1.5, z: 0.3 } },
                { isFront: false, isLeft: false, position: { x: -0.8, y: -1.5, z: 0.3 } },
              ],
            },
          },
        ],
      };

      const level = await levelLoader.loadLevel(levelJson);

      // Every wheel inherits its display from sharedWheelOptions
      expect(world.visualScene?.factory.createCylinder).toHaveBeenCalledTimes(4);
      expect(world.visualScene?.factory.createCylinder).toHaveBeenCalledWith(0.3, 0.25, {});

      const car = level.getChildEntityByName<GgCarEntity>('TestCar2');
      expect(car).toBeInstanceOf(GgCarEntity);
    });

    it('should throw when GgCar chassis dimensions are missing', async () => {
      const levelJson: LevelJson = {
        entities: [{ class: 'GgCar', config: { ...carCommonConfig, chassis: {}, wheelOptions: [] } }],
      };
      await expect(levelLoader.loadLevel(levelJson)).rejects.toThrow('Chassis dimensions are required for GgCar class');
    });

    it('should throw when GgCar has neither wheelBase nor wheelOptions', async () => {
      const levelJson: LevelJson = {
        entities: [
          { class: 'GgCar', config: { ...carCommonConfig, chassis: { dimensions: { x: 1, y: 1, z: 1 } } } },
        ],
      };
      await expect(levelLoader.loadLevel(levelJson)).rejects.toThrow(
        'Either "wheelBase" or "wheelOptions" is required for GgCar class',
      );
    });

    it('should load a level with a MapGraph built from a flat node array', async () => {
      const levelJson: LevelJson = {
        entities: [
          {
            class: 'MapGraph',
            name: 'TestMapGraph',
            config: {
              graph: {
                nodes: [
                  { path: 'tiles/a', position: { x: 0, y: 0, z: 0 } },
                  { path: 'tiles/b', position: { x: 10, y: 0, z: 0 } },
                  { path: 'tiles/c', position: { x: 20, y: 0, z: 0 } },
                ],
              },
              loadDepth: 2,
              inertia: 1,
              maxNodesLoadingPerTick: 3,
              loadRateLimit: 5,
            },
          },
        ],
      };

      const level = await levelLoader.loadLevel(levelJson);

      const mapGraph = level.getChildEntityByName<MapGraph3dEntity>('TestMapGraph');
      expect(mapGraph).toBeInstanceOf(MapGraph3dEntity);
      expect(mapGraph.mapGraph.nodes()).toHaveLength(3);
      expect(mapGraph.mapGraph.data).toEqual({
        path: 'tiles/a',
        position: { x: 0, y: 0, z: 0 },
        loadOptions: {},
      });
      expect(mapGraph.loadRateLimit).toBe(5);
    });

    it('should load a level with a MapGraph built from a square grid', async () => {
      const levelJson: LevelJson = {
        entities: [
          {
            class: 'MapGraph',
            name: 'TestGridMapGraph',
            config: {
              graph: {
                type: 'grid',
                grid: [
                  [
                    { path: 'tiles/00', position: { x: 0, y: 0, z: 0 } },
                    { path: 'tiles/01', position: { x: 10, y: 0, z: 0 } },
                  ],
                  [
                    { path: 'tiles/10', position: { x: 0, y: 10, z: 0 } },
                    { path: 'tiles/11', position: { x: 10, y: 10, z: 0 } },
                  ],
                ],
              },
            },
          },
        ],
      };

      const level = await levelLoader.loadLevel(levelJson);

      const mapGraph = level.getChildEntityByName<MapGraph3dEntity>('TestGridMapGraph');
      expect(mapGraph).toBeInstanceOf(MapGraph3dEntity);
      expect(mapGraph.mapGraph.nodes()).toHaveLength(4);
    });

    it('should throw when MapGraph "graph" is missing', async () => {
      const levelJson: LevelJson = { entities: [{ class: 'MapGraph', config: {} }] };
      await expect(levelLoader.loadLevel(levelJson)).rejects.toThrow('"graph" is required for MapGraph class');
    });

    it('should throw when MapGraph array graph has no nodes', async () => {
      const levelJson: LevelJson = { entities: [{ class: 'MapGraph', config: { graph: { nodes: [] } } }] };
      await expect(levelLoader.loadLevel(levelJson)).rejects.toThrow(
        '"graph.nodes" must be a non-empty array for MapGraph class',
      );
    });

    it('should throw when MapGraph grid graph is empty', async () => {
      const levelJson: LevelJson = {
        entities: [{ class: 'MapGraph', config: { graph: { type: 'grid', grid: [] } } }],
      };
      await expect(levelLoader.loadLevel(levelJson)).rejects.toThrow(
        '"graph.grid" must be a non-empty grid for MapGraph class',
      );
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
            position: { x: 1, y: 2, z: 3 },
            name: 'TestCustomEntity',
            config: {
              customProperty: 'value',
            },
          },
        ],
      };

      // Load the level
      const level = await levelLoader.loadLevel(levelJson);

      // Verify that the custom generator was called with the correct arguments, and reachable by name
      expect(mockGenerator).toHaveBeenCalledWith(world, {
        position: { x: 1, y: 2, z: 3 },
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
      const level = await levelLoader.loadLevel(levelJson);

      // Verify that no entity was created and a warning was logged
      expect(() => level.getChildEntityByName('TestUnknownEntity')).toThrow(
        'No child entity named "TestUnknownEntity"',
      );
      expect(console.warn).toHaveBeenCalledWith('No generator registered for class alias "UnknownEntity"');

      // Restore console.warn
      console.warn = originalWarn;
    });
  });
});
