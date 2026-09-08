import { CharacterController3dEntity, KeyboardInput, Pnt3, PlayerCharacterController, Qtrn } from '@gg-web-engine/core';
import { Rapier3dWorldComponent } from '../../src';

// A camera looking horizontally toward +Y - identity rotation would look straight down (local -Z
// maps to world -Z at identity, in this Z-up engine), a degenerate/arbitrary case for
// `PlayerCharacterController.reset()`'s yaw derivation; every real app sets an actual look
// direction, so this is the representative case.
const fakeCamera = () => ({ position: { x: 0, y: 0, z: 0 }, rotation: Qtrn.lookAt(Pnt3.O, Pnt3.Y) }) as any;

const setup = async () => {
  const world = new Rapier3dWorldComponent();
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
    character.tick$.next([elapsed, dt]);
    controller.tick$.next([elapsed, dt]);
  };

  for (let i = 0; i < 10; i++) tickBoth(i * 16, 16);
  expect(character.isGrounded).toBe(true);

  return { world, character, keyboard, controller, tickBoth };
};

describe('PlayerCharacterController + Rapier3dCharacterControllerComponent - end-to-end', () => {
  it('walks forward the expected distance and jumps when the real physics is driven through the real input controller', async () => {
    const { character, keyboard, tickBoth } = await setup();
    const settledY = character.position.y;
    const settledZ = character.position.z;

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
    const actualDistance = settledY - character.position.y;
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

describe('CharacterController3dEntity + Rapier3dCharacterControllerComponent - slope rejection', () => {
  it('slides off a too-steep sphere flank under gravity instead of staying stuck with no input', async () => {
    // No PlayerCharacterController/keyboard involved here - this is purely gravity vs.
    // `isWalkableGround`, driven with real (nonzero) gravity, unlike this file's other tests.
    const world = new Rapier3dWorldComponent();
    await world.init();
    world.gravity = { x: 0, y: 0, z: -9.82 };
    const floor = world.factory.createRigidBody(
      { shape: { shape: 'BOX', dimensions: { x: 100, y: 100, z: 1 } }, body: { dynamic: false, mass: 0 } },
      { position: { x: 0, y: 0, z: -0.5 } },
    );
    floor.addToWorld({ physicsWorld: world } as any);
    const sphere = world.factory.createRigidBody(
      { shape: { shape: 'SPHERE', radius: 1 }, body: { dynamic: false, mass: 0 } },
      { position: { x: 0, y: 0, z: 1 } },
    );
    sphere.addToWorld({ physicsWorld: world } as any);

    // touching position at dx=1.2 from sphere center: dz=sqrt(1.4^2-1.2^2)~=0.721 -> z~=1.721, a
    // contact whose true outward normal is ~59° off `up` - past the default ~50°
    // `maxSlopeClimbAngleRad`, so the character should slide straight off it, not stand there.
    const characterController = world.factory.createCharacterController(
      { radius: 0.4, centersDistance: 1.0 },
      { position: { x: 1.2, y: 0, z: 1.73 } },
    );
    const character = new CharacterController3dEntity(
      { radius: 0.4, centersDistance: 1.0, walkSpeed: 4, jumpSpeed: 4 },
      null,
      characterController,
    );
    character.onSpawned({ physicsWorld: world } as any);
    world.simulate(1);

    const dtMs = 16;
    for (let i = 0; i < 200; i++) {
      character.tick$.next([i * dtMs, dtMs]);
      world.simulate(dtMs);
    }

    // must not remain perched on the sphere flank (z would stay well above the floor's resting
    // height, ~0.91, if stuck) - regression test for computeGroundNormal() falling back to a flat
    // `up` normal on the many idle ticks that find zero fresh collisions while still (correctly)
    // grounded via snap - see gg-engine-physics-adapter-rapier's "computeGroundNormal" pitfall.
    expect(character.position.z).toBeLessThan(1.2);
    expect(character.isGrounded).toBe(true);
  });
});
