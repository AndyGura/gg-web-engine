import { CharacterController3dEntity } from '@gg-web-engine/core';
import { Rapier3dWorldComponent } from '../../src';

describe('Rapier3dCharacterControllerComponent - free fall sanity', () => {
  it('falls under gravity in empty space (no floor at all) at a physically plausible rate', async () => {
    const world = new Rapier3dWorldComponent();
    await world.init();
    // the native world's own gravity must stay zero - CharacterController3dEntity integrates
    // gravity itself and feeds the adapter the full displacement each tick (see
    // ICharacterController3dComponent's doc)
    world.gravity = { x: 0, y: 0, z: 0 };

    const startZ = 1000; // high up, nothing below at all - pure free fall, no ground anywhere
    const characterController = world.factory.createCharacterController(
      { radius: 0.4, centersDistance: 1.0 },
      { position: { x: 0, y: 0, z: startZ } },
    );
    const entity = new CharacterController3dEntity({ radius: 0.4, centersDistance: 1.0, gravity: 9.82 }, null, characterController);
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
    // precision test: it must catch "falls absurdly fast" (an order of magnitude or more off), not
    // nitpick integration error
    expect(actualDrop).toBeGreaterThan(expectedDrop * 0.5);
    expect(actualDrop).toBeLessThan(expectedDrop * 2);
  });
});
