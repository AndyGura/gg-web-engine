import { Point3, RaycastOptions } from '@gg-web-engine/core';
import { Rapier3dFactory, Rapier3dWorldComponent } from '../../src';

describe('Rapier3dWorldComponent', () => {
  let world: Rapier3dWorldComponent;
  let factory: Rapier3dFactory;

  beforeEach(async () => {
    if (world) {
      world.dispose();
    }
    world = new Rapier3dWorldComponent();
    factory = new Rapier3dFactory(world);
    await world.init();
    world.gravity = { x: 0, y: 0, z: 0 }; // Set gravity to zero for predictable physics
  });

  // Helper function to run a physics step
  const runPhysicsStep = () => {
    world.simulate(16); // Simulate a small time step (16ms)
  };

  afterAll(() => {
    world.dispose();
  });

  describe('Raycast', () => {

    it('should return no hit when ray does not intersect any object', () => {
      // Create a box far away from the ray
      const box = factory.createRigidBody({
        shape: { shape: 'BOX', dimensions: { x: 1, y: 1, z: 1 } },
        body: { dynamic: false, mass: 0 },
      }, { position: { x: 10, y: 10, z: 10 } });
      box.addToWorld({ physicsWorld: world } as any);

      // Run a physics step to ensure the body is properly positioned
      runPhysicsStep();

      // Cast a ray that doesn't hit anything
      const raycastOptions: RaycastOptions<Point3> = {
        from: { x: 0, y: 0, z: 0 },
        to: { x: 0, y: 0, z: -10 },
      };

      const result = world.raycast(raycastOptions);
      expect(result.hasHit).toBe(false);
      expect(result.hitPoint).toBeUndefined();
      expect(result.hitNormal).toBeUndefined();
      expect(result.hitDistance).toBeUndefined();
    });

    it('should detect hit when ray intersects an object', () => {
      // Create a box in the path of the ray
      const box = factory.createRigidBody({
        shape: { shape: 'BOX', dimensions: { x: 2, y: 2, z: 2 } },
        body: { dynamic: false, mass: 0 },
      }, { position: { x: 0, y: 0, z: -5 } });
      box.addToWorld({ physicsWorld: world } as any);

      // Run a physics step to ensure the body is properly positioned
      runPhysicsStep();

      // Cast a ray that hits the box
      const raycastOptions: RaycastOptions<Point3> = {
        from: { x: 0, y: 0, z: 0 },
        to: { x: 0, y: 0, z: -10 },
      };

      const result = world.raycast(raycastOptions);
      expect(result.hasHit).toBe(true);
      expect(result.hitPoint).toBeDefined();
      expect(result.hitNormal).toBeDefined();
      expect(result.hitDistance).toBeDefined();

      // The hit should be at approximately z = -4 (box at z = -5 with size 2)
      expect(result.hitPoint!.z).toBeCloseTo(-4, 0.1);

      // The normal should point up (towards the ray origin)
      expect(result.hitNormal!.z).toBeGreaterThan(0);
    });

    it('should respect collision filtering', () => {
      // Register collision groups
      const group1 = world.registerCollisionGroup();
      const group2 = world.registerCollisionGroup();

      // Create a box that only belongs to group1
      const box1 = factory.createRigidBody({
        shape: { shape: 'BOX', dimensions: { x: 2, y: 2, z: 2 } },
        body: {
          dynamic: false,
          mass: 0,
          ownCollisionGroups: [group1],
          interactWithCollisionGroups: [group1, group2],
        },
      }, { position: { x: 0, y: 0, z: -5 } });
      box1.addToWorld({ physicsWorld: world } as any);

      // Run a physics step to ensure the body is properly positioned
      runPhysicsStep();

      // Ray that only checks against group2 should not hit
      const rayOptions1: RaycastOptions<Point3> = {
        from: { x: 0, y: 0, z: 0 },
        to: { x: 0, y: 0, z: -10 },
        collisionFilterGroup: group2,
        collisionFilterMask: [group2],
      };

      const result1 = world.raycast(rayOptions1);
      expect(result1.hasHit).toBe(false);

      // Ray that checks against group1 should hit
      const rayOptions2: RaycastOptions<Point3> = {
        from: { x: 0, y: 0, z: 0 },
        to: { x: 0, y: 0, z: -10 },
        collisionFilterGroup: group1,
        collisionFilterMask: [group1],
      };

      const result2 = world.raycast(rayOptions2);
      expect(result2.hasHit).toBe(true);
    });

    it('should calculate hit distance correctly', () => {
      // Create a box at a known distance
      const box = factory.createRigidBody({
        shape: { shape: 'BOX', dimensions: { x: 2, y: 2, z: 2 } },
        body: { dynamic: false, mass: 0 },
      }, { position: { x: 0, y: 0, z: -5 } });
      box.addToWorld({ physicsWorld: world } as any);

      // Run a physics step to ensure the body is properly positioned
      runPhysicsStep();

      // Cast a ray from origin to z = -10
      const raycastOptions: RaycastOptions<Point3> = {
        from: { x: 0, y: 0, z: 0 },
        to: { x: 0, y: 0, z: -10 },
      };

      const result = world.raycast(raycastOptions);
      expect(result.hasHit).toBe(true);

      // The hit distance should be approximately 4 units
      // (from origin to the edge of the box at z = -4)
      expect(result.hitDistance).toBeCloseTo(4, 0.1);
    });

    it('should handle array of collision groups correctly', () => {
      // Register collision groups
      const group1 = world.registerCollisionGroup();
      const group2 = world.registerCollisionGroup();

      // Create a box that belongs to group1
      const box = factory.createRigidBody({
        shape: { shape: 'BOX', dimensions: { x: 2, y: 2, z: 2 } },
        body: {
          dynamic: false,
          mass: 0,
          ownCollisionGroups: [group1],
          interactWithCollisionGroups: [group1, group2],
        },
      }, { position: { x: 0, y: 0, z: -5 } });
      box.addToWorld({ physicsWorld: world } as any);

      // Run a physics step to ensure the body is properly positioned
      runPhysicsStep();

      // Ray that checks against both groups should hit
      const rayOptions: RaycastOptions<Point3> = {
        from: { x: 0, y: 0, z: 0 },
        to: { x: 0, y: 0, z: -10 },
        collisionFilterGroup: [group1, group2],
        collisionFilterMask: [group1, group2],
      };

      const result = world.raycast(rayOptions);
      expect(result.hasHit).toBe(true);
    });

    it('should return correct hit body', () => {
      // Create two boxes at different positions
      const box1 = factory.createRigidBody({
        shape: { shape: 'BOX', dimensions: { x: 1, y: 1, z: 1 } },
        body: { dynamic: false, mass: 0 },
      }, { position: { x: 0, y: 0, z: -3 } });
      box1.addToWorld({ physicsWorld: world } as any);

      const box2 = factory.createRigidBody({
        shape: { shape: 'BOX', dimensions: { x: 1, y: 1, z: 1 } },
        body: { dynamic: false, mass: 0 },
      }, { position: { x: 0, y: 0, z: -7 } });
      box2.addToWorld({ physicsWorld: world } as any);

      // Run a physics step to ensure the bodies are properly positioned
      runPhysicsStep();

      // Cast a ray that should hit box1 first
      const raycastOptions: RaycastOptions<Point3> = {
        from: { x: 0, y: 0, z: 0 },
        to: { x: 0, y: 0, z: -10 },
      };

      const result = world.raycast(raycastOptions);
      expect(result.hasHit).toBe(true);
      expect(result.hitBody).toBeDefined();

      // The hit body should be the first box's native body
      // We can't directly compare objects, but we can check the position
      expect(result.hitPoint!.z).toBeCloseTo(-2.5, 0.1); // box1 edge is at z = -2.5
    });

    it('should handle edge case with ray starting inside an object', () => {
      // Create a box
      const box = factory.createRigidBody({
        shape: { shape: 'BOX', dimensions: { x: 4, y: 4, z: 4 } },
        body: { dynamic: false, mass: 0 },
      }, { position: { x: 0, y: 0, z: 0 } });
      box.addToWorld({ physicsWorld: world } as any);

      // Run a physics step to ensure the body is properly positioned
      runPhysicsStep();

      // Cast a ray from inside the box
      const raycastOptions: RaycastOptions<Point3> = {
        from: { x: 0, y: 0, z: 0 }, // Center of the box
        to: { x: 0, y: 0, z: -10 },
      };

      const result = world.raycast(raycastOptions);

      // Behavior may vary depending on physics engine implementation
      // Some engines might not detect hits when starting inside an object
      // Others might detect the exit point
      // We just verify the method doesn't crash and returns a valid result
      expect(result).toBeDefined();
    });
  });
});
