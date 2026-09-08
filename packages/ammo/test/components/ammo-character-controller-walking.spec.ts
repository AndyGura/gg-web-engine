import { CharacterController3dEntity } from '@gg-web-engine/core';
import { AmmoWorldComponent } from '../../src';

describe('AmmoCharacterControllerComponent - continuous walking over a real floor', () => {
  it('stays grounded and covers the expected distance walking forward continuously', () => {
    const world = new AmmoWorldComponent();
    return world.init().then(() => {
      world.gravity = { x: 0, y: 0, z: 0 };
      const floor = world.factory.createRigidBody(
        { shape: { shape: 'BOX', dimensions: { x: 100, y: 100, z: 1 } }, body: { dynamic: false, mass: 0 } },
        { position: { x: 0, y: 0, z: -0.5 } },
      );
      floor.addToWorld({ physicsWorld: world } as any);

      const characterController = world.factory.createCharacterController(
        { radius: 0.4, centersDistance: 1.0 },
        { position: { x: 0, y: 0, z: 1.0 } },
      );
      const entity = new CharacterController3dEntity({ radius: 0.4, centersDistance: 1.0, walkSpeed: 4, gravity: 9.82 }, null, characterController);
      entity.onSpawned({ physicsWorld: world } as any);
      world.simulate(1); // register floor/character in broadphase before any move()

      // settle onto the floor first (starts 1 unit above the surface)
      for (let i = 0; i < 10; i++) {
        entity.tick$.next([i * 16, 16]);
      }
      expect(entity.isGrounded).toBe(true);
      const settledY = entity.position.y;
      const groundedDuringSettle: boolean[] = [];

      const dtMs = 16;
      const steps = 60; // ~1 simulated second, holding "forward" the whole time
      entity.moveDirection = { x: 0, y: 1, z: 0 };
      for (let i = 0; i < steps; i++) {
        entity.tick$.next([i * dtMs, dtMs]);
        groundedDuringSettle.push(entity.isGrounded);
      }

      const elapsedSeconds = (steps * dtMs) / 1000;
      const expectedDistance = 4 * elapsedSeconds; // walkSpeed * time
      const actualDistance = entity.position.y - settledY;

      console.log(`expected forward distance: ~${expectedDistance.toFixed(2)}m, actual: ${actualDistance.toFixed(2)}m`);
      console.log(`grounded flickers: ${groundedDuringSettle.filter(g => !g).length} / ${groundedDuringSettle.length} ticks NOT grounded`);

      expect(groundedDuringSettle.every(g => g)).toBe(true); // never leaves the ground while walking on a flat floor
      expect(actualDistance).toBeGreaterThan(expectedDistance * 0.8);
      expect(actualDistance).toBeLessThan(expectedDistance * 1.2);
    });
  });

  it('walks backward the same way it walks forward', () => {
    const world = new AmmoWorldComponent();
    return world.init().then(() => {
      world.gravity = { x: 0, y: 0, z: 0 };
      const floor = world.factory.createRigidBody(
        { shape: { shape: 'BOX', dimensions: { x: 100, y: 100, z: 1 } }, body: { dynamic: false, mass: 0 } },
        { position: { x: 0, y: 0, z: -0.5 } },
      );
      floor.addToWorld({ physicsWorld: world } as any);

      const characterController = world.factory.createCharacterController(
        { radius: 0.4, centersDistance: 1.0 },
        { position: { x: 0, y: 0, z: 1.0 } },
      );
      const entity = new CharacterController3dEntity({ radius: 0.4, centersDistance: 1.0, walkSpeed: 4, gravity: 9.82 }, null, characterController);
      entity.onSpawned({ physicsWorld: world } as any);
      world.simulate(1);

      for (let i = 0; i < 10; i++) {
        entity.tick$.next([i * 16, 16]);
      }
      const settledY = entity.position.y;

      entity.moveDirection = { x: 0, y: -1, z: 0 }; // backward
      const dtMs = 16;
      const steps = 60;
      for (let i = 0; i < steps; i++) {
        entity.tick$.next([i * dtMs, dtMs]);
      }

      const elapsedSeconds = (steps * dtMs) / 1000;
      const expectedDistance = 4 * elapsedSeconds;
      const actualDistance = settledY - entity.position.y; // moved in -Y

      console.log(`expected backward distance: ~${expectedDistance.toFixed(2)}m, actual: ${actualDistance.toFixed(2)}m`);

      expect(actualDistance).toBeGreaterThan(expectedDistance * 0.8);
      expect(actualDistance).toBeLessThan(expectedDistance * 1.2);
    });
  });
});
