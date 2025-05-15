import { Point2, RaycastOptions } from '@gg-web-engine/core';
import { Rapier2dWorldComponent } from '../../src';

describe('Rapier2dWorldComponent', () => {
  let world: Rapier2dWorldComponent;

  beforeEach(async () => {
    if (world) {
      world.dispose();
    }
    world = new Rapier2dWorldComponent();
    await world.init();
    world.gravity = { x: 0, y: 0 }; // Set gravity to zero for predictable physics
  });

  afterAll(() => {
    world.dispose();
  });

  describe('Rigid bodies', () => {

    it('should simulate inertial motion of rigid body', () => {

      const circle = world.factory.createRigidBody({
        shape: { shape: 'CIRCLE', radius: 1 },
        body: { dynamic: true, mass: 5 },
      }, { position: { x: -5, y: 0 } });
      circle.addToWorld({ physicsWorld: world } as any);
      circle.linearVelocity = { x: 1, y: 0 };

      // simulate for 6 seconds
      for (let i = 0; i < 100; i++) {
        world.simulate(60);
      }
      expect(circle.position.x).toBeCloseTo(1);
    });

    it('should simulate collision of two rigid bodies', () => {

      const circle0 = world.factory.createRigidBody({
        shape: { shape: 'CIRCLE', radius: 1 },
        body: { dynamic: true, mass: 5 },
      }, { position: { x: -5, y: 0 } });
      circle0.addToWorld({ physicsWorld: world } as any);
      circle0.linearVelocity = { x: 1, y: 0 };

      const circle1 = world.factory.createRigidBody({
        shape: { shape: 'CIRCLE', radius: 1 },
        body: { dynamic: true, mass: 5 },
      }, { position: { x: 5, y: 0 } });
      circle1.addToWorld({ physicsWorld: world } as any);
      circle1.linearVelocity = { x: -1, y: 0 };

      // simulate for 6 seconds
      for (let i = 0; i < 100; i++) {
        world.simulate(60);
      }
      expect(circle0.position.x).toBeLessThan(0);
      expect(circle1.position.x).toBeGreaterThan(0);
    });

    it('should not simulate collision of two rigid bodies with different collision groups', () => {
      const cg0 = world.registerCollisionGroup();
      const circle0 = world.factory.createRigidBody({
        shape: { shape: 'CIRCLE', radius: 1 },
        body: { dynamic: true, mass: 5 },
      }, { position: { x: -5, y: 0 } });
      circle0.addToWorld({ physicsWorld: world } as any);
      circle0.linearVelocity = { x: 1, y: 0 };
      circle0.ownCollisionGroups = circle0.interactWithCollisionGroups = [cg0];

      const cg1 = world.registerCollisionGroup();
      const circle1 = world.factory.createRigidBody({
        shape: { shape: 'CIRCLE', radius: 1 },
        body: { dynamic: true, mass: 5 },
      }, { position: { x: 5, y: 0 } });
      circle1.addToWorld({ physicsWorld: world } as any);
      circle1.linearVelocity = { x: -1, y: 0 };
      circle1.ownCollisionGroups = circle1.interactWithCollisionGroups = [cg1];

      // simulate for 6 seconds
      for (let i = 0; i < 100; i++) {
        world.simulate(60);
      }
      expect(circle0.position.x).toBeCloseTo(1);
      expect(circle1.position.x).toBeCloseTo(-1);
    });
  });

  describe('Raycast', () => {

    it('should return no hit when ray does not intersect any object', () => {
      // Create a square far away from the ray
      const square = world.factory.createRigidBody({
        shape: { shape: 'SQUARE', dimensions: { x: 1, y: 1 } },
        body: { dynamic: false, mass: 0 },
      }, { position: { x: 10, y: 10 } });
      square.addToWorld({ physicsWorld: world } as any);

      world.simulate(1);

      // Cast a ray that doesn't hit anything
      const raycastOptions: RaycastOptions<Point2> = {
        from: { x: 0, y: 0 },
        to: { x: 0, y: -10 },
      };

      const result = world.raycast(raycastOptions);
      expect(result.hasHit).toBe(false);
      expect(result.hitPoint).toBeUndefined();
      expect(result.hitNormal).toBeUndefined();
      expect(result.hitDistance).toBeUndefined();
    });

    it('should detect hit when ray intersects an object', () => {
      // Create a square in the path of the ray
      const square = world.factory.createRigidBody({
        shape: { shape: 'SQUARE', dimensions: { x: 2, y: 2 } },
        body: { dynamic: false, mass: 0 },
      }, { position: { x: 0, y: -5 } });
      square.addToWorld({ physicsWorld: world } as any);

      world.simulate(1);

      // Cast a ray that hits the square
      const raycastOptions: RaycastOptions<Point2> = {
        from: { x: 0, y: 0 },
        to: { x: 0, y: -10 },
      };

      const result = world.raycast(raycastOptions);
      expect(result.hasHit).toBe(true);
      expect(result.hitBody).toBe(square);
      expect(result.hitPoint).toBeDefined();
      expect(result.hitNormal).toBeDefined();
      expect(result.hitDistance).toBeDefined();

      // The hit should be at approximately y = -4 (box at y = -5 with size 2)
      expect(result.hitPoint!.y).toBeCloseTo(-4, 0.1);

      // The normal should point up (towards the ray origin)
      expect(result.hitNormal!.y).toBeGreaterThan(0);
    });

    it('should respect collision filtering', () => {
      // Register collision groups
      const group1 = world.registerCollisionGroup();
      const group2 = world.registerCollisionGroup();

      // Create a square that only belongs to group1
      const square1 = world.factory.createRigidBody({
        shape: { shape: 'SQUARE', dimensions: { x: 2, y: 2 } },
        body: {
          dynamic: false,
          mass: 0,
          ownCollisionGroups: [group1],
          interactWithCollisionGroups: [group1, group2],
        },
      }, { position: { x: 0, y: -5 } });
      square1.addToWorld({ physicsWorld: world } as any);

      world.simulate(1);

      // Ray that only checks against group2 should not hit
      const rayOptions1: RaycastOptions<Point2> = {
        from: { x: 0, y: 0 },
        to: { x: 0, y: -10 },
        collisionFilterGroups: [group2],
        collisionFilterMask: [group2],
      };

      const result1 = world.raycast(rayOptions1);
      expect(result1.hasHit).toBe(false);

      // Ray that checks against group1 should hit
      const rayOptions2: RaycastOptions<Point2> = {
        from: { x: 0, y: 0 },
        to: { x: 0, y: -10 },
        collisionFilterGroups: [group1],
        collisionFilterMask: [group1],
      };

      const result2 = world.raycast(rayOptions2);
      expect(result2.hasHit).toBe(true);
      expect(result2.hitBody).toBe(square1);
    });

    it('should calculate hit distance correctly', () => {
      // Create a square at a known distance
      const square = world.factory.createRigidBody({
        shape: { shape: 'SQUARE', dimensions: { x: 2, y: 2 } },
        body: { dynamic: false, mass: 0 },
      }, { position: { x: 0, y: -5 } });
      square.addToWorld({ physicsWorld: world } as any);

      world.simulate(1);

      // Cast a ray from origin to y = -10
      const raycastOptions: RaycastOptions<Point2> = {
        from: { x: 0, y: 0 },
        to: { x: 0, y: -10 },
      };

      const result = world.raycast(raycastOptions);
      expect(result.hasHit).toBe(true);

      // The hit distance should be approximately 4 units
      // (from origin to the edge of the square at y = -4)
      expect(result.hitDistance).toBeCloseTo(4, 0.1);
    });

    it('should handle array of collision groups correctly', () => {
      // Register collision groups
      const group1 = world.registerCollisionGroup();
      const group2 = world.registerCollisionGroup();

      // Create a square that belongs to group1
      const square = world.factory.createRigidBody({
        shape: { shape: 'SQUARE', dimensions: { x: 2, y: 2 } },
        body: {
          dynamic: false,
          mass: 0,
          ownCollisionGroups: [group1],
          interactWithCollisionGroups: [group1, group2],
        },
      }, { position: { x: 0, y: -5 } });
      square.addToWorld({ physicsWorld: world } as any);

      world.simulate(1);

      // Ray that checks against both groups should hit
      const rayOptions: RaycastOptions<Point2> = {
        from: { x: 0, y: 0 },
        to: { x: 0, y: -10 },
        collisionFilterGroups: [group1, group2],
        collisionFilterMask: [group1, group2],
      };

      const result = world.raycast(rayOptions);
      expect(result.hasHit).toBe(true);
    });

    it('should return correct hit body', () => {
      // Create two squares at different positions
      const square1 = world.factory.createRigidBody({
        shape: { shape: 'SQUARE', dimensions: { x: 1, y: 1 } },
        body: { dynamic: false, mass: 0 },
      }, { position: { x: 0, y: -3 } });
      square1.addToWorld({ physicsWorld: world } as any);

      const square2 = world.factory.createRigidBody({
        shape: { shape: 'SQUARE', dimensions: { x: 1, y: 1 } },
        body: { dynamic: false, mass: 0 },
      }, { position: { x: 0, y: -7 } });
      square2.addToWorld({ physicsWorld: world } as any);

      world.simulate(1);

      // Cast a ray that should hit square1 first
      const raycastOptions: RaycastOptions<Point2> = {
        from: { x: 0, y: 0 },
        to: { x: 0, y: -10 },
      };

      const result = world.raycast(raycastOptions);
      expect(result.hasHit).toBe(true);
      expect(result.hitBody).toBe(square1);
      expect(result.hitPoint!.y).toBeCloseTo(-2.5, 0.1); // square1 edge is at y = -2.5
    });

    it('should handle edge case with ray starting inside an object', () => {
      // Create a square
      const square = world.factory.createRigidBody({
        shape: { shape: 'SQUARE', dimensions: { x: 4, y: 4 } },
        body: { dynamic: false, mass: 0 },
      }, { position: { x: 0, y: 0 } });
      square.addToWorld({ physicsWorld: world } as any);

      world.simulate(1);

      // Cast a ray from inside the square
      const raycastOptions: RaycastOptions<Point2> = {
        from: { x: 0, y: 0 }, // Center of the square
        to: { x: 0, y: -10 },
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