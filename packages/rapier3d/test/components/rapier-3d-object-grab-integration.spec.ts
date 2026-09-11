import {
  CharacterController3dEntity,
  Grabbable3dEntity,
  KeyboardInput,
  MouseInput,
  ObjectGrabController,
  Pnt3,
  Point3,
  Qtrn,
} from '@gg-web-engine/core';
import { Rapier3dWorldComponent } from '../../src';

/**
 * Regression coverage for the Rapier3d-specific counterpart of
 * `packages/ammo/test/components/ammo-world.component.spec.ts`'s "should still grab a small target
 * sitting closer than the ray origin overshoots to" test - both reproduce the same real scene (the
 * `portal-room` example's pedestal + radio prop), but they can't share a test body: the two adapters
 * were broken by, and fixed for, two different bugs at two different layers.
 *
 * Ammo's gap lived in `AmmoWorldComponent.raycast()` itself - Bullet's plain `rayTest` can't detect a
 * shape already containing the ray's origin at all, so a ray landing *inside* the small prop found
 * nothing until the adapter grew its own `solidRayFallback`. Rapier never had that gap -
 * `Rapier3dWorldComponent.raycast()`'s `castRay(..., solid: true, ...)` already reports a distance-`0`
 * hit for whatever shape contains the ray's origin, prop included, with no adapter-level fix needed.
 *
 * Rapier's bug was one level up, in `ObjectGrabController.tryGrab()` itself: `solid: true` doesn't
 * just handle a ray landing inside the prop, it makes *any* containing shape win over anything
 * farther away - so with the camera sitting inside the holder's own capsule (the ordinary
 * first-person case), `tryGrab()`'s first, un-skipped cast always self-hit that capsule before ever
 * reaching the prop, on every single attempt, close range or not. Recovering from that self-hit is
 * `characterControllerSelfHitSkip()`'s job (see `gg-engine-core-development`'s own notes on it) - so
 * these tests exercise that recovery through the real `ObjectGrabController` + real
 * `Rapier3dWorldComponent` + real character-controller collider, not `Rapier3dWorldComponent.raycast()`
 * in isolation (which, per the above, was never the part that was broken).
 */
describe('ObjectGrabController + Rapier3dWorldComponent - end-to-end pick-up range', () => {
  const setupPedestalAndRadio = (world: Rapier3dWorldComponent, radioPosition: Point3) => {
    const pedestal = world.factory.createRigidBody(
      { shape: { shape: 'CYLINDER', radius: 0.5, height: 0.9 }, body: { dynamic: false, mass: 0 } },
      { position: { x: 0, y: 0, z: 0.45 } },
    );
    pedestal.addToWorld({ physicsWorld: world } as any);

    const propBody = world.factory.createRigidBody(
      { shape: { shape: 'BOX', dimensions: { x: 0.41, y: 0.23, z: 0.49 } }, body: { dynamic: true, mass: 3 } },
      { position: radioPosition },
    );
    propBody.addToWorld({ physicsWorld: world } as any);
    return new Grabbable3dEntity({ objectBody: propBody });
  };

  it('grabs a small prop resting on a pedestal even standing very close to it', async () => {
    const world = new Rapier3dWorldComponent();
    await world.init();
    world.gravity = { x: 0, y: 0, z: 0 };

    // Same geometry as the `portal-room` example (and the Ammo regression test referenced above): a
    // pedestal with a small radio prop resting on top of it.
    const prop = setupPedestalAndRadio(world, { x: 0, y: 0, z: 1.145 });

    // player capsule radius 0.4 + centersDistance 1.0, matching both the example's own player
    // options and the Ammo test's holder.
    const characterController = world.factory.createCharacterController(
      { radius: 0.4, centersDistance: 1.0 },
      { position: { x: 0, y: -1.1, z: 1.0 } },
    );
    const holder = new CharacterController3dEntity(
      { radius: 0.4, centersDistance: 1.0, walkSpeed: 4, jumpSpeed: 5, gravity: 9.82 },
      null,
      characterController,
    );
    holder.onSpawned({ physicsWorld: world } as any);
    world.simulate(1);

    // playerDistance = 1.1 (same number as the Ammo test) - close enough that the camera (same
    // height as the prop, a purely horizontal look - no pitch needed to reproduce this) sits well
    // within the holder capsule's own radius from its central axis, so `tryGrab()`'s first cast is
    // guaranteed to self-hit that capsule before the retry this test is actually exercising kicks in.
    const cameraPosition = { x: 0, y: -1.1, z: 1.145 };
    const camera = { position: cameraPosition, rotation: Qtrn.lookAt(cameraPosition, { x: 0, y: 0, z: 1.145 }) } as any;

    const keyboard = new KeyboardInput();
    keyboard.start();
    const mouseInput = new MouseInput();
    mouseInput.start();
    const controller = new ObjectGrabController(keyboard, mouseInput, camera, holder);
    controller.onSpawned({ physicsWorld: world } as any);

    keyboard.emulateKeyDown('KeyE');

    expect(controller.heldObject).toBe(prop);
  });

  it(
    'grabs the prop at the exact position/rotation a real gameplay report found it ungrabbable at ' +
      "(regression: a flat `radius`-sized self-hit skip - characterControllerSelfHitSkip()'s first " +
      'implementation - cleared the capsule fine for a purely horizontal look, but the real ' +
      "first-person camera here sits 0.7m above the capsule center (`PlayerCharacterController`'s " +
      'default eyeHeight) - taller than the capsule half-height (0.5m) - so it starts inside the ' +
      "rounded top cap, not the cylindrical body; the camera's real downward pitch toward the low " +
      "radio then meant a flat radius skip landed the retry ray's start point still measurably " +
      'inside the capsule, self-hitting again and leaving the radio permanently ungrabbable at this ' +
      'exact spot. Fixed by sphere-tracing the capsule\'s own exact geometry instead of guessing a ' +
      "flat distance - see `characterControllerSelfHitSkip()`'s own doc)",
    async () => {
      const world = new Rapier3dWorldComponent();
      await world.init();
      world.gravity = { x: 0, y: 0, z: -9.82 };

      // Exact positions read from the in-game dev console's entity inspector during the failing
      // report, not guessed.
      const radioPosition = { x: -0.010856885462999344, y: 0.004407098516821861, z: 0.8990808129310608 };
      const prop = setupPedestalAndRadio(world, radioPosition);

      const playerPosition = { x: 0.03676546365022659, y: -0.9093552231788635, z: 0.9099816679954529 };
      const playerRotation = { x: 0, y: 0, z: 0.01860076382738503, w: 0.9998269908264321 };
      const characterController = world.factory.createCharacterController(
        { radius: 0.4, centersDistance: 1.0 },
        { position: playerPosition, rotation: playerRotation },
      );
      const holder = new CharacterController3dEntity(
        { radius: 0.4, centersDistance: 1.0, walkSpeed: 4, jumpSpeed: 4, gravity: 9.82 },
        null,
        characterController,
      );
      holder.onSpawned({ physicsWorld: world } as any);
      world.simulate(1);

      // First-person camera at `PlayerCharacterController`'s default eyeHeight (0.7) above the
      // player capsule's own center, looking at the radio - reproducing the actual aim, not just the
      // position.
      const cameraPosition = Pnt3.add(playerPosition, Pnt3.scalarMult(Pnt3.Z, 0.7));
      const camera = { position: cameraPosition, rotation: Qtrn.lookAt(cameraPosition, radioPosition) } as any;

      const keyboard = new KeyboardInput();
      keyboard.start();
      const mouseInput = new MouseInput();
      mouseInput.start();
      const controller = new ObjectGrabController(keyboard, mouseInput, camera, holder);
      controller.onSpawned({ physicsWorld: world } as any);

      keyboard.emulateKeyDown('KeyE');

      expect(controller.heldObject).toBe(prop);
    },
  );
});
