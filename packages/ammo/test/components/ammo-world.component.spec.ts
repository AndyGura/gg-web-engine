import { AmmoWorldComponent } from '../../src';

describe('AmmoWorldComponent', () => {
  let world: AmmoWorldComponent;

  beforeEach(async () => {
    if (world) {
      world.dispose();
    }
    world = new AmmoWorldComponent();
    await world.init();
    world.gravity = { x: 0, y: 0, z: 0 }; // Set gravity to zero for predictable physics
  });

  afterAll(() => {
    world.dispose();
  });

  describe('Rigid bodies', () => {

    it('should simulate inertial motion of rigid body', () => {

      const ball = world.factory.createRigidBody({
        shape: { shape: 'SPHERE', radius: 1 },
        body: { dynamic: true, mass: 5 },
      }, { position: { x: -5, y: 0, z: 0 } });
      ball.addToWorld({ physicsWorld: world } as any);
      ball.linearVelocity = { x: 1, y: 0, z: 0 };

      // simulate for 6 seconds
      for (let i = 0; i < 100; i++) {
        world.simulate(60);
      }
      expect(ball.position.x).toBeCloseTo(1);
    });

    it('should simulate collision of two rigid bodies', () => {

      const ball0 = world.factory.createRigidBody({
        shape: { shape: 'SPHERE', radius: 1 },
        body: { dynamic: true, mass: 5 },
      }, { position: { x: -5, y: 0, z: 0 } });
      ball0.addToWorld({ physicsWorld: world } as any);
      ball0.linearVelocity = { x: 1, y: 0, z: 0 };

      const ball1 = world.factory.createRigidBody({
        shape: { shape: 'SPHERE', radius: 1 },
        body: { dynamic: true, mass: 5 },
      }, { position: { x: 5, y: 0, z: 0 } });
      ball1.addToWorld({ physicsWorld: world } as any);
      ball1.linearVelocity = { x: -1, y: 0, z: 0 };

      // simulate for 6 seconds
      for (let i = 0; i < 100; i++) {
        world.simulate(60);
      }
      expect(ball0.position.x).toBeLessThan(0);
      expect(ball1.position.x).toBeGreaterThan(0);
    });

    it('should not simulate collision of two rigid bodies with different collision groups', () => {
      const cg0 = world.registerCollisionGroup();
      const ball0 = world.factory.createRigidBody({
        shape: { shape: 'SPHERE', radius: 1 },
        body: { dynamic: true, mass: 5 },
      }, { position: { x: -5, y: 0, z: 0 } });
      ball0.addToWorld({ physicsWorld: world } as any);
      ball0.linearVelocity = { x: 1, y: 0, z: 0 };
      ball0.ownCollisionGroups = ball0.interactWithCollisionGroups = [cg0];

      const cg1 = world.registerCollisionGroup();
      const ball1 = world.factory.createRigidBody({
        shape: { shape: 'SPHERE', radius: 1 },
        body: { dynamic: true, mass: 5 },
      }, { position: { x: 5, y: 0, z: 0 } });
      ball1.addToWorld({ physicsWorld: world } as any);
      ball1.linearVelocity = { x: -1, y: 0, z: 0 };
      ball1.ownCollisionGroups = ball1.interactWithCollisionGroups = [cg1];

      // simulate for 6 seconds
      for (let i = 0; i < 100; i++) {
        world.simulate(60);
      }
      expect(ball0.position.x).toBeCloseTo(1);
      expect(ball1.position.x).toBeCloseTo(-1);
    });
  });
});