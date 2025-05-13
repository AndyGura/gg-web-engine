import { MatterWorldComponent } from '../../src';

describe('MatterWorldComponent', () => {
  let world: MatterWorldComponent;

  beforeEach(async () => {
    if (world) {
      world.dispose();
    }
    world = new MatterWorldComponent();
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
      circle.nativeBody.frictionAir = 0;

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
      circle0.nativeBody.frictionAir = 0;

      const circle1 = world.factory.createRigidBody({
        shape: { shape: 'CIRCLE', radius: 1 },
        body: { dynamic: true, mass: 5 },
      }, { position: { x: 5, y: 0 } });
      circle1.addToWorld({ physicsWorld: world } as any);
      circle1.linearVelocity = { x: -1, y: 0 };
      circle1.nativeBody.frictionAir = 0;

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
      circle0.nativeBody.frictionAir = 0;
      circle0.ownCollisionGroups = circle0.interactWithCollisionGroups = [cg0];

      const cg1 = world.registerCollisionGroup();
      const circle1 = world.factory.createRigidBody({
        shape: { shape: 'CIRCLE', radius: 1 },
        body: { dynamic: true, mass: 5 },
      }, { position: { x: 5, y: 0 } });
      circle1.addToWorld({ physicsWorld: world } as any);
      circle1.linearVelocity = { x: -1, y: 0 };
      circle1.nativeBody.frictionAir = 0;
      circle1.ownCollisionGroups = circle1.interactWithCollisionGroups = [cg1];

      // simulate for 6 seconds
      for (let i = 0; i < 100; i++) {
        world.simulate(60);
      }
      expect(circle0.position.x).toBeCloseTo(1);
      expect(circle1.position.x).toBeCloseTo(-1);
    });
  });
});