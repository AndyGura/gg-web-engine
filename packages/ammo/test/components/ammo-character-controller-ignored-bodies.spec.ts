import { CharacterController3dEntity } from '@gg-web-engine/core';
import { AmmoWorldComponent } from '../../src';

// Regression coverage for `ICharacterController3dComponent.ignoredBodies`: collision groups alone
// cannot express "this specific dynamic body never blocks this specific character's own movement"
// while both still need to collide with the rest of the world (see that interface's own doc, and
// `Grabbable3dEntity`/`ObjectGrabController`'s docs for the concrete held-prop-blocks-its-own-holder
// bug this exists to fix). These tests exercise the real fix end to end against a live Ammo world:
// `sweep()`/`recoverFromPenetration()` temporarily pulling an ignored body out of the collision
// world's broadphase for the duration of each query.
describe('AmmoCharacterControllerComponent - ignoredBodies', () => {
  const setupWorldWithObstacle = () => {
    const world = new AmmoWorldComponent();
    return world.init().then(() => {
      world.gravity = { x: 0, y: 0, z: 0 };
      const floor = world.factory.createRigidBody(
        { shape: { shape: 'BOX', dimensions: { x: 100, y: 100, z: 1 } }, body: { dynamic: false, mass: 0 } },
        { position: { x: 0, y: 0, z: -0.5 } },
      );
      floor.addToWorld({ physicsWorld: world } as any);

      // Squarely in the character's path 2m ahead - spans y in [1.5, 2.5], well within the capsule's
      // own z-range once standing on the floor.
      const obstacle = world.factory.createRigidBody(
        { shape: { shape: 'BOX', dimensions: { x: 2, y: 1, z: 2 } }, body: { dynamic: true, mass: 3 } },
        { position: { x: 0, y: 2, z: 1.0 } },
      );
      obstacle.addToWorld({ physicsWorld: world } as any);

      const characterController = world.factory.createCharacterController(
        { radius: 0.4, centersDistance: 1.0 },
        { position: { x: 0, y: 0, z: 1.0 } },
      );
      const entity = new CharacterController3dEntity(
        { radius: 0.4, centersDistance: 1.0, walkSpeed: 4, gravity: 9.82 },
        null,
        characterController,
      );
      entity.onSpawned({ physicsWorld: world } as any);
      world.simulate(1); // register everything in broadphase before any move()

      // settle onto the floor first
      for (let i = 0; i < 10; i++) {
        entity.tick$.next([i * 16, 16]);
      }

      return { characterController, entity, obstacle };
    });
  };

  const walkForwardFor = (entity: CharacterController3dEntity, steps: number, dtMs: number) => {
    entity.moveDirection = { x: 0, y: 1, z: 0 };
    for (let i = 0; i < steps; i++) {
      entity.tick$.next([i * dtMs, dtMs]);
    }
  };

  it('a dynamic body directly in the path blocks ordinary walking (baseline, nothing ignored)', () => {
    return setupWorldWithObstacle().then(({ entity }) => {
      const startY = entity.position.y;
      walkForwardFor(entity, 60, 16); // ~1s at walkSpeed 4 -> ~4m if nothing were in the way

      const actualDistance = entity.position.y - startY;
      // obstacle's near face is at y=1.5; the capsule (radius 0.4) can approach to roughly y=1.1
      expect(actualDistance).toBeLessThan(1.5);
    });
  });

  it("adding the obstacle's body to ignoredBodies lets the character walk straight through it", () => {
    return setupWorldWithObstacle().then(({ characterController, entity, obstacle }) => {
      characterController.ignoredBodies.add(obstacle);

      const startY = entity.position.y;
      walkForwardFor(entity, 60, 16);
      const actualDistance = entity.position.y - startY;

      const elapsedSeconds = (60 * 16) / 1000;
      const expectedDistance = 4 * elapsedSeconds; // walkSpeed * time, same as an obstacle-free walk
      expect(actualDistance).toBeGreaterThan(expectedDistance * 0.8);
    });
  });

  it('removing the body from ignoredBodies makes it a solid obstacle again', () => {
    return setupWorldWithObstacle().then(({ characterController, entity, obstacle }) => {
      characterController.ignoredBodies.add(obstacle);
      characterController.ignoredBodies.delete(obstacle);

      const startY = entity.position.y;
      walkForwardFor(entity, 60, 16);
      const actualDistance = entity.position.y - startY;

      expect(actualDistance).toBeLessThan(1.5);
    });
  });
});
