import { Pnt3 } from '@gg-web-engine/core';
import { Rapier3dFactory, Rapier3dWorldComponent } from '../src';

describe('Rapier3dFactory', () => {
  let world: Rapier3dWorldComponent;
  let factory: Rapier3dFactory;

  beforeEach(async () => {
    if (world) {
      world.dispose();
    }
    world = new Rapier3dWorldComponent();
    factory = new Rapier3dFactory(world);
    await world.init();
    world.gravity = Pnt3.O;
  });

  afterAll(() => {
    world.dispose();
  });

  describe('createCharacterController', () => {
    it('should produce a component usable without any extra setup', () => {
      const character = factory.createCharacterController(
        { radius: 0.4, centersDistance: 1.0 },
        { position: { x: 0, y: 0, z: 5 } },
      );
      expect(character.radius).toBe(0.4);
      expect(character.centersDistance).toBe(1.0);
      expect(character.position).toEqual({ x: 0, y: 0, z: 5 });
      expect(character.ownCollisionGroups).toEqual([world.mainCollisionGroup]);
      expect(character.interactWithCollisionGroups).toEqual(Array.from({ length: 16 }, (_, i) => i)); // 'all' default

      character.addToWorld({ physicsWorld: world } as any);
      expect(character.nativeBody).not.toBeNull();
      expect(character.nativeCollider).not.toBeNull();
      expect(character.nativeController).not.toBeNull();

      // works: a downward move against a floor grounds it, fully synchronously
      const floor = factory.createRigidBody(
        { shape: { shape: 'BOX', dimensions: { x: 20, y: 20, z: 1 } }, body: { dynamic: false, mass: 0 } },
        { position: { x: 0, y: 0, z: -0.5 } },
      );
      floor.addToWorld({ physicsWorld: world } as any);
      // a freshly-created static collider only enters Rapier's broad-phase as part of a world step;
      // a zero-length step registers it without moving anything (see the character-controller spec
      // for the full explanation)
      world.simulate(0);
      character.move({ x: 0, y: 0, z: -10 });
      expect(character.isGrounded).toBe(true);

      character.removeFromWorld({ physicsWorld: world } as any);
      expect(character.nativeBody).toBeNull();
    });

    it('should respect explicit collision group overrides', () => {
      const group = world.registerCollisionGroup();
      const character = factory.createCharacterController({
        radius: 0.4,
        centersDistance: 1.0,
        ownCollisionGroups: [group],
        interactWithCollisionGroups: [group],
      });
      expect(character.ownCollisionGroups).toEqual([group]);
      expect(character.interactWithCollisionGroups).toEqual([group]);
    });
  });
});
