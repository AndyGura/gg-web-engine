import { CharacterController3dEntity, KeyboardInput, Pnt3, PlayerCharacterController, Qtrn } from '@gg-web-engine/core';
import { AmmoWorldComponent } from '../../src';

// A camera looking horizontally toward +Y - identity rotation would look straight down (local -Z
// maps to world -Z at identity, in this Z-up engine), which is a degenerate/arbitrary case for
// `PlayerCharacterController.reset()`'s yaw derivation (atan2(0,0)); every real app sets an actual
// look direction before/immediately after spawning a camera, so this is the representative case.
const fakeCamera = () => ({ position: { x: 0, y: 0, z: 0 }, rotation: Qtrn.lookAt(Pnt3.O, Pnt3.Y) }) as any;

const setup = async () => {
  const world = new AmmoWorldComponent();
  await world.init();
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
  const character = new CharacterController3dEntity(
    { radius: 0.4, centersDistance: 1.0, walkSpeed: 4, jumpSpeed: 5, gravity: 9.82 },
    null,
    characterController,
  );
  character.onSpawned({ physicsWorld: world } as any);
  world.simulate(1);

  const keyboard = new KeyboardInput();
  keyboard.start();
  const camera = fakeCamera();
  const controller = new PlayerCharacterController(keyboard, character, camera);
  await controller.onSpawned({ physicsWorld: world } as any);

  const tickBoth = (elapsed: number, dt: number) => {
    // mirrors the real per-frame order: character (tickOrder 195) before controller (800)
    character.tick$.next([elapsed, dt]);
    controller.tick$.next([elapsed, dt]);
  };

  // settle onto the floor
  for (let i = 0; i < 10; i++) tickBoth(i * 16, 16);
  expect(character.isGrounded).toBe(true);

  return { world, character, keyboard, controller, tickBoth };
};

describe('crouch + ceiling + jump - end-to-end (regression: jumping while crouched under a ceiling too low to stand under stood the character up mid-air and clipped it into the ceiling)', () => {
  it('never stands up (or ends up embedded in the ceiling) across a whole jump while crouched under too-low a ceiling, even after the crouch key was released', async () => {
    const world = new AmmoWorldComponent();
    await world.init();
    world.gravity = { x: 0, y: 0, z: 0 };
    const floor = world.factory.createRigidBody(
      { shape: { shape: 'BOX', dimensions: { x: 100, y: 100, z: 1 } }, body: { dynamic: false, mass: 0 } },
      { position: { x: 0, y: 0, z: -0.5 } },
    );
    floor.addToWorld({ physicsWorld: world } as any);

    // mirrors the `player-character-three-ammo` example's "CrouchBeam": underside at
    // z = 2.1 - 0.5 = 1.6. A standing capsule (radius 0.4, centersDistance 1.0, half-height 0.9)
    // needs its center below 0.7 to fit under it - well below its own resting height (0.9) - so
    // standing here is genuinely impossible; only crouched (centersDistance 0.6, half-height 0.7,
    // resting center 0.7, top at 1.4) fits, with 0.2m of headroom to spare, not the 0.4m standing
    // up from a crouch would need.
    const beam = world.factory.createRigidBody(
      { shape: { shape: 'BOX', dimensions: { x: 4, y: 1, z: 1 } }, body: { dynamic: false, mass: 0 } },
      { position: { x: 0, y: 3, z: 2.1 } },
    );
    beam.addToWorld({ physicsWorld: world } as any);

    const characterController = world.factory.createCharacterController(
      { radius: 0.4, centersDistance: 1.0 },
      { position: { x: 0, y: -3, z: 1.0 } }, // well clear of the beam's y in [2.5, 3.5] footprint
    );
    const character = new CharacterController3dEntity(
      { radius: 0.4, centersDistance: 1.0, walkSpeed: 4, jumpSpeed: 4, gravity: 9.82 },
      null,
      characterController,
    );
    character.onSpawned({ physicsWorld: world } as any);
    world.simulate(1);

    const tick = (elapsed: number, dt: number) => character.tick$.next([elapsed, dt]);

    // settle standing on the floor, away from the beam, then crouch (always succeeds immediately -
    // no obstruction way out here)
    for (let i = 0; i < 10; i++) tick(i * 16, 16);
    expect(character.isGrounded).toBe(true);
    character.isCrouching = true;
    tick(160, 16);
    expect(character.isCrouching).toBe(true);

    // teleport straight under the beam's footprint at the crouched resting height, rather than
    // walking there - the walking mechanics themselves are already covered by the tests above,
    // this test is only about what happens once positioned under too-low a ceiling
    character.position = { x: 0, y: 3, z: character.position.z };
    world.simulate(0); // re-register the moved ghost object's transform with the broadphase
    tick(176, 16);
    expect(character.isGrounded).toBe(true);
    expect(character.isCrouching).toBe(true);

    // release the crouch key: headroom check must find the beam and stay crouched (this much
    // already worked before this fix - the reported regression was specifically what jumping did
    // next)
    character.isCrouching = false;
    expect(character.isCrouching).toBe(true);

    character.jump();
    const stoodUpAt: number[] = [];
    const embeddedAt: number[] = [];
    const beamUnderside = 1.6;
    for (let i = 0; i < 60; i++) {
      tick(192 + i * 16, 16);
      if (!character.isCrouching) {
        stoodUpAt.push(i);
      }
      const halfHeight = character.characterController.radius + character.characterController.centersDistance / 2;
      const top = character.position.z + halfHeight;
      if (top > beamUnderside + 1e-6) {
        embeddedAt.push(i);
      }
    }

    expect(stoodUpAt).toEqual([]);
    expect(embeddedAt).toEqual([]);
    expect(character.isCrouching).toBe(true);
  });
});

describe('PlayerCharacterController + AmmoCharacterControllerComponent - end-to-end', () => {
  it('walks forward the expected distance and jumps when the real physics is driven through the real input controller', async () => {
    const { character, keyboard, tickBoth } = await setup();
    const settledY = character.position.y;
    const settledZ = character.position.z;

    // hold "forward" (W) for ~1 simulated second
    keyboard.emulateKeyDown('KeyW');
    const dtMs = 16;
    const steps = 60;
    const groundedThroughout: boolean[] = [];
    for (let i = 0; i < steps; i++) {
      tickBoth(i * dtMs, dtMs);
      groundedThroughout.push(character.isGrounded);
    }
    keyboard.emulateKeyUp('KeyW');

    const elapsedSeconds = (steps * dtMs) / 1000;
    const expectedDistance = 4 * elapsedSeconds;
    const actualDistance = character.position.y - settledY;
    console.log(`forward: expected ~${expectedDistance.toFixed(2)}m, actual ${actualDistance.toFixed(2)}m`);
    expect(groundedThroughout.every(g => g)).toBe(true);
    expect(actualDistance).toBeGreaterThan(expectedDistance * 0.8);
    expect(actualDistance).toBeLessThan(expectedDistance * 1.2);

    // jump: should rise noticeably above the settled height, not stay flat
    expect(character.isGrounded).toBe(true);
    keyboard.emulateKeyDown('Space');
    keyboard.emulateKeyUp('Space');
    let peakZ = character.position.z;
    for (let i = 0; i < 30; i++) {
      tickBoth((steps + i) * dtMs, dtMs);
      peakZ = Math.max(peakZ, character.position.z);
    }
    console.log(`jump: settled z ${settledZ.toFixed(2)}, peak z during jump ${peakZ.toFixed(2)}`);
    expect(peakZ).toBeGreaterThan(settledZ + 0.3);
  });

  it('walks backward the expected distance, without resistance', async () => {
    const { character, keyboard, tickBoth } = await setup();
    const settledY = character.position.y;

    keyboard.emulateKeyDown('KeyS');
    const dtMs = 16;
    const steps = 60;
    const groundedThroughout: boolean[] = [];
    for (let i = 0; i < steps; i++) {
      tickBoth(i * dtMs, dtMs);
      groundedThroughout.push(character.isGrounded);
    }
    keyboard.emulateKeyUp('KeyS');

    const elapsedSeconds = (steps * dtMs) / 1000;
    const expectedDistance = 4 * elapsedSeconds;
    const actualDistance = settledY - character.position.y; // moved in -Y (backward)
    console.log(`backward: expected ~${expectedDistance.toFixed(2)}m, actual ${actualDistance.toFixed(2)}m`);
    expect(groundedThroughout.every(g => g)).toBe(true);
    expect(actualDistance).toBeGreaterThan(expectedDistance * 0.8);
    expect(actualDistance).toBeLessThan(expectedDistance * 1.2);
  });

  it.each([
    ['right', 'KeyD', 1],
    ['left', 'KeyA', -1],
  ])('strafes %s the expected distance, without resistance', async (_label, key, sign) => {
    const { character, keyboard, tickBoth } = await setup();
    const settledX = character.position.x;

    keyboard.emulateKeyDown(key);
    const dtMs = 16;
    const steps = 60;
    const groundedThroughout: boolean[] = [];
    for (let i = 0; i < steps; i++) {
      tickBoth(i * dtMs, dtMs);
      groundedThroughout.push(character.isGrounded);
    }
    keyboard.emulateKeyUp(key);

    const elapsedSeconds = (steps * dtMs) / 1000;
    const expectedDistance = 4 * elapsedSeconds;
    const actualDistance = (character.position.x - settledX) * sign;
    console.log(`strafe ${_label}: expected ~${expectedDistance.toFixed(2)}m, actual ${actualDistance.toFixed(2)}m`);
    expect(groundedThroughout.every(g => g)).toBe(true);
    expect(actualDistance).toBeGreaterThan(expectedDistance * 0.8);
    expect(actualDistance).toBeLessThan(expectedDistance * 1.2);
  });
});
