import { CharacterController3dOptions, Pnt3 } from '@gg-web-engine/core';
import { Rapier3dFactory, Rapier3dWorldComponent } from '../../src';

// Regression coverage for the gap where `Trigger3dEntity.onEntityEntered`/`onEntityLeft` silently
// never fired for a `Rapier3dCharacterControllerComponent` (the "Player" built-in / any app-authored
// character), because `Rapier3dWorldComponent.handleIdEntityMap` never registered a character
// controller's native body handle - `dispatchCollisionEvents` resolved both sides of every sensor
// pair through that same map, so a pair involving a character controller always bailed out at
// `if (!comp1 || !comp2 ...)` before ever reaching `Rapier3dTriggerComponent.notifyOverlap`. See
// `Rapier3dCharacterControllerComponent`'s own class doc and `Rapier3dWorldComponent.handleIdEntityMap`'s
// doc for the fix. Vehicles need no equivalent test here - a raycast vehicle's chassis is an ordinary
// `Rapier3dRigidBodyComponent` (see `packages/core`'s `RaycastVehicle3dEntity`), already covered by
// `rapier-3d-trigger.component.spec.ts`'s plain rigid-body cases; Rapier3d itself doesn't implement
// raycast vehicles at all (`Rapier3dFactory.createRaycastVehicle` throws), so Ammo is the only adapter
// with real vehicle physics to exercise.
describe(`Rapier3dTriggerComponent x Rapier3dCharacterControllerComponent`, () => {
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

  const CHAR_OPTIONS: CharacterController3dOptions = { radius: 0.4, centersDistance: 1.0 };

  // Mirrors `rapier-3d-trigger.component.spec.ts`'s own `advance` helper/doc - many small steps so a
  // step-boundary lag in `EventQueue` drainage never reads as a missed event, and `checkOverlaps()`
  // runs every step (not just once at the end) since `EventQueue` is constructed with `autoDrain: true`.
  const advance = (totalMs: number, onStep: () => void, stepMs = 10) => {
    for (let elapsed = 0; elapsed < totalMs; elapsed += stepMs) {
      world.simulate(stepMs);
      onStep();
    }
  };

  it('fires onEntityEntered/onEntityLeft for a character controller walking through it', () => {
    const trigger = factory.createTrigger({ shape: 'BOX', dimensions: { x: 10, y: 10, z: 10 } });
    trigger.addToWorld({ physicsWorld: world } as any);

    const character = factory.createCharacterController(CHAR_OPTIONS, { position: { x: -8, y: 0, z: 0 } });
    character.addToWorld({ physicsWorld: world } as any);
    // register the freshly-created colliders with Rapier's broad-phase before the first move, same
    // as `rapier-3d-character-controller.component.spec.ts`'s own `settleWorld()`.
    world.simulate(0);

    let entered: unknown;
    let exited: unknown;
    trigger.onEntityEntered.subscribe(obj => (entered = obj));
    trigger.onEntityLeft.subscribe(obj => (exited = obj));

    // walk from x=-8 to x=12 (1 unit/step over 20 steps), straight through the trigger's -5..5 span.
    for (let i = 0; i < 20; i++) {
      character.move({ x: 1, y: 0, z: 0 });
      advance(10, () => trigger.checkOverlaps());
    }

    expect(entered).toBe(character);
    expect(exited).toBe(character);
  });

  it('fires onEntityEntered for a character controller already spawned inside it', () => {
    const trigger = factory.createTrigger({ shape: 'BOX', dimensions: { x: 10, y: 10, z: 10 } });
    trigger.addToWorld({ physicsWorld: world } as any);

    const character = factory.createCharacterController(CHAR_OPTIONS, { position: { x: 0, y: 0, z: 0 } });
    character.addToWorld({ physicsWorld: world } as any);

    let entered: unknown;
    trigger.onEntityEntered.subscribe(obj => (entered = obj));

    advance(500, () => trigger.checkOverlaps());

    expect(entered).toBe(character);
  });
});
