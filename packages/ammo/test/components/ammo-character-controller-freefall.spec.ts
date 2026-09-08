import { CharacterController3dEntity } from '@gg-web-engine/core';
import { AmmoWorldComponent } from '../../src';

describe('AmmoCharacterControllerComponent - free fall sanity', () => {
  it('falls under gravity in empty space (no floor at all) at a physically plausible rate', () => {
    const world = new AmmoWorldComponent();
    return world.init().then(() => {
      // Leave `world.gravity` at its default (-9.82 along z) and the entity's own `gravity` option
      // unset (undefined) - this is the normal/default wiring (see `gravity`'s doc on
      // `CharacterController3dEntityOptions`): `CharacterController3dEntity` reads
      // `physicsWorld.gravity` live every tick and integrates it itself, since a kinematic character
      // controller is never affected by the native engine's own gravity integration (that only
      // applies to dynamic rigid bodies - see `ICharacterController3dComponent`'s doc), regardless of
      // what `world.gravity` is set to. This test is what actually proves the character obeys world
      // gravity by default, not just that an explicit numeric override falls correctly.

      const startZ = 1000; // high up, nothing below at all - pure free fall, no ground anywhere
      const characterController = world.factory.createCharacterController(
        { radius: 0.4, centersDistance: 1.0 },
        { position: { x: 0, y: 0, z: startZ } },
      );
      const entity = new CharacterController3dEntity({ radius: 0.4, centersDistance: 1.0 }, null, characterController);
      entity.onSpawned({ physicsWorld: world } as any);

      const dtMs = 16;
      const steps = 60; // ~1 simulated second
      for (let i = 0; i < steps; i++) {
        entity.tick$.next([i * dtMs, dtMs]);
      }

      const elapsedSeconds = (steps * dtMs) / 1000;
      const expectedDrop = 0.5 * 9.82 * elapsedSeconds * elapsedSeconds; // free fall from rest, ~4.9m after 1s
      const actualDrop = startZ - entity.position.z;

      console.log(`expected drop after ${elapsedSeconds}s: ~${expectedDrop.toFixed(2)}m, actual: ${actualDrop.toFixed(2)}m`);

      // generous tolerance for discrete Euler integration - this is a sanity bound, not a physics
      // precision test: it must catch "falls absurdly fast" (an order of magnitude or more off),
      // not nitpick integration error
      expect(actualDrop).toBeGreaterThan(expectedDrop * 0.5);
      expect(actualDrop).toBeLessThan(expectedDrop * 2);
    });
  });
});
