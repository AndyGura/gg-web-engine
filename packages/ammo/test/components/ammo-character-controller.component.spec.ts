import { Qtrn } from '@gg-web-engine/core';
import { AmmoCharacterControllerComponent, AmmoFactory, AmmoRigidBodyComponent, AmmoWorldComponent } from '../../src';

const createFloor = (
  factory: AmmoFactory,
  topZ: number,
  dimensions: { x: number; y: number; z: number } = { x: 50, y: 50, z: 1 },
): AmmoRigidBodyComponent =>
  factory.createRigidBody(
    { shape: { shape: 'BOX', dimensions }, body: { dynamic: false, mass: 0 } },
    { position: { x: 0, y: 0, z: topZ - dimensions.z / 2 } },
  );

describe('AmmoCharacterControllerComponent', () => {
  let world: AmmoWorldComponent;
  let factory: AmmoFactory;

  beforeEach(async () => {
    if (world) {
      world.dispose();
    }
    world = new AmmoWorldComponent();
    await world.init();
    factory = world.factory;
    // the character controller resolves its own movement synchronously inside `move()` and never
    // relies on `world.simulate()` - zero out world gravity so nothing else in these tests
    // (e.g. the static floors, which ignore gravity anyway) can move on its own either.
    world.gravity = { x: 0, y: 0, z: 0 };
  });

  afterAll(() => {
    world.dispose();
  });

  // A freshly `addToWorld()`-ed collision object (rigid body or the character's own ghost object)
  // only actually enters Bullet's broadphase as part of running `stepSimulation()` at least once -
  // the same quirk already documented/worked around for every other query in this package (every
  // `AmmoRaycastVehicleComponent`/`world.raycast()` test calls `world.simulate(...)` once after
  // `addToWorld()` too). This is a one-time "register with the broadphase" step, orthogonal to the
  // interface's synchronous-`move()` contract: it's never called *between* or *after* `move()`
  // calls in any of these tests, only once up front before the first one.
  const settleWorld = () => world.simulate(1);

  it('resolves position/isGrounded synchronously within move() itself - no world.simulate() call needed once set up', () => {
    // Regression test for the interface's core synchronous contract: once `settleWorld()` has
    // registered the floor/character with the broadphase, this test never calls `world.simulate()`/
    // `stepSimulation()` again, and still expects a single `move()` call to fully resolve the
    // character falling onto, and coming to rest on, the floor below it.
    const floor = createFloor(factory, 0);
    floor.addToWorld({ physicsWorld: world } as any);

    const character = factory.createCharacterController(
      { radius: 0.4, centersDistance: 1.0 },
      { position: { x: 0, y: 0, z: 5 } },
    );
    character.addToWorld({ physicsWorld: world } as any);
    settleWorld();

    expect(character.isGrounded).toBe(false);
    expect(character.groundNormal).toBeNull();

    // one single move() call carrying the whole (oversized) desired drop
    character.move({ x: 0, y: 0, z: -10 });

    // capsule half-height above its geometric center is radius + centersDistance/2 = 0.9, so it
    // should have settled with its center just above z=0 (the floor's top surface)
    expect(character.position.z).toBeGreaterThan(0.85);
    expect(character.position.z).toBeLessThan(0.95);
    expect(character.isGrounded).toBe(true);
    expect(character.groundNormal).toEqual({ x: 0, y: 0, z: 1 });
  });

  it('settles onto a flat floor from a small drop', () => {
    const floor = createFloor(factory, 0);
    floor.addToWorld({ physicsWorld: world } as any);

    const character = factory.createCharacterController(
      { radius: 0.4, centersDistance: 1.0 },
      { position: { x: 0, y: 0, z: 1.0 } },
    );
    character.addToWorld({ physicsWorld: world } as any);
    settleWorld();

    for (let i = 0; i < 5; i++) {
      character.move({ x: 0, y: 0, z: -0.5 });
    }

    expect(character.isGrounded).toBe(true);
    expect(character.position.z).toBeGreaterThan(0.85);
    expect(character.position.z).toBeLessThan(0.95);
  });

  it('is slowed/stopped when walking directly into a wall', () => {
    const floor = createFloor(factory, 0);
    floor.addToWorld({ physicsWorld: world } as any);

    const wall = factory.createRigidBody(
      { shape: { shape: 'BOX', dimensions: { x: 0.5, y: 10, z: 5 } }, body: { dynamic: false, mass: 0 } },
      { position: { x: 2, y: 0, z: 2 } },
    );
    wall.addToWorld({ physicsWorld: world } as any);

    const character = factory.createCharacterController(
      { radius: 0.4, centersDistance: 1.0 },
      { position: { x: 0, y: 0, z: 1.0 } },
    );
    character.addToWorld({ physicsWorld: world } as any);
    settleWorld();

    // settle onto the floor first
    for (let i = 0; i < 5; i++) {
      character.move({ x: 0, y: 0, z: -0.5 });
    }
    expect(character.isGrounded).toBe(true);

    // the wall's near face is at x = 2 - 0.25 = 1.75; the character (radius 0.4) can approach to
    // about x = 1.35 before being blocked - walk far past that in one call
    character.move({ x: 5, y: 0, z: 0 });

    expect(character.position.x).toBeGreaterThan(0);
    expect(character.position.x).toBeLessThan(1.6);
  });

  it('steps up a ledge no taller than maxStepHeight', () => {
    const lowFloor = createFloor(factory, 0, { x: 4, y: 4, z: 1 });
    lowFloor.addToWorld({ physicsWorld: world } as any);
    // a ledge 0.2 above the low floor (default maxStepHeight is 0.3), starting right where the
    // low floor ends (x=2) and extending far enough out (to x=22) that walking 40 steps of 0.2
    // starting from x=0 (ending around x=8) never runs off its far edge
    const ledge = factory.createRigidBody(
      { shape: { shape: 'BOX', dimensions: { x: 20, y: 4, z: 1 } }, body: { dynamic: false, mass: 0 } },
      { position: { x: 12, y: 0, z: 0.2 - 0.5 } },
    );
    ledge.addToWorld({ physicsWorld: world } as any);

    const character = factory.createCharacterController(
      { radius: 0.4, centersDistance: 1.0 },
      { position: { x: 0, y: 0, z: 1.0 } },
    );
    character.addToWorld({ physicsWorld: world } as any);
    settleWorld();

    // settle onto the low floor first
    for (let i = 0; i < 5; i++) {
      character.move({ x: 0, y: 0, z: -0.5 });
    }
    expect(character.isGrounded).toBe(true);
    expect(character.position.z).toBeCloseTo(0.9, 1);

    // walk straight towards and past the ledge, purely horizontally - no vertical component - the
    // native controller's own step-up handling must lift the character onto it
    for (let i = 0; i < 40; i++) {
      character.move({ x: 0.2, y: 0, z: 0 });
    }

    expect(character.position.x).toBeGreaterThan(2.5);
    expect(character.isGrounded).toBe(true);
    // resting on top of the ledge (z = 0.2) means center z should be close to 1.1, not 0.9
    expect(character.position.z).toBeGreaterThan(1.0);
  });

  it('does not climb a tall vertical cylinder while repeatedly bumping/sliding along its curved side (regression: the step-up assist accepted spurious clearance improvements from the curvature alone and incrementally lifted the character up it)', () => {
    const floor = createFloor(factory, 0);
    floor.addToWorld({ physicsWorld: world } as any);

    // a tall vertical cylinder - far too tall to ever be a legitimate "step" at maxStepHeight (0.3)
    const cylinder = factory.createRigidBody(
      { shape: { shape: 'CYLINDER', radius: 1, height: 5 }, body: { dynamic: false, mass: 0 } },
      { position: { x: 2, y: 0, z: 2.5 } },
    );
    cylinder.addToWorld({ physicsWorld: world } as any);

    const character = factory.createCharacterController(
      { radius: 0.4, centersDistance: 1.0 },
      { position: { x: 0, y: -1, z: 1.0 } },
    );
    character.addToWorld({ physicsWorld: world } as any);
    settleWorld();

    // settle onto the floor first
    for (let i = 0; i < 5; i++) {
      character.move({ x: 0, y: 0, z: -0.5 });
    }
    expect(character.position.z).toBeCloseTo(0.9, 1);

    // walk repeatedly against/along the cylinder's curved side (pressing inward while sliding
    // sideways past it), the same kind of contact "going around" it would produce
    for (let i = 0; i < 60; i++) {
      character.move({ x: 0.05, y: 0.03, z: 0 });
    }

    expect(character.position.z).toBeLessThan(1.0);
  });

  it('is blocked by a low overhead beam while standing, even though its underside is above the capsule center', () => {
    const floor = createFloor(factory, 0);
    floor.addToWorld({ physicsWorld: world } as any);

    // standing capsule (radius 0.4, centersDistance 1.0) has half-height 0.9 above its center, so
    // once settled on the floor (center z ~= 0.9) its top is at ~1.8 - a beam whose underside is at
    // 1.6 overlaps the top 0.2 of the capsule and must block it
    const beam = factory.createRigidBody(
      { shape: { shape: 'BOX', dimensions: { x: 4, y: 1, z: 1 } }, body: { dynamic: false, mass: 0 } },
      { position: { x: 3, y: 0, z: 2.1 } },
    );
    beam.addToWorld({ physicsWorld: world } as any);

    const character = factory.createCharacterController(
      { radius: 0.4, centersDistance: 1.0 },
      { position: { x: 0, y: 0, z: 1.0 } },
    );
    character.addToWorld({ physicsWorld: world } as any);
    settleWorld();

    // settle onto the floor first
    for (let i = 0; i < 5; i++) {
      character.move({ x: 0, y: 0, z: -0.5 });
    }
    expect(character.position.z).toBeCloseTo(0.9, 1);

    // walk straight towards and through the beam's footprint - purely horizontal, still standing
    for (let i = 0; i < 40; i++) {
      character.move({ x: 0.2, y: 0, z: 0 });
    }

    // the beam's near face is at x = 3 - 2 = 1, the character (radius 0.4) can approach to about
    // x = 0.6 before being blocked - it must never pass through to the far side (beam's far face
    // plus character radius would be x = 5.4)
    expect(character.position.x).toBeLessThan(1.0);
  });

  it('slides sideways instead of getting stuck when pressed straight down onto a surface steeper than maxSlopeClimbAngleRad (regression: was never grounded, but also never actually slid off - stayed jittering in place against the slope)', () => {
    // an 80deg-tilted ramp (default maxSlopeClimbAngleRad is 50deg) - its surface normal tilts
    // mostly towards +X, well past the walkable limit
    const rampAngle = (80 * Math.PI) / 180;
    const ramp = factory.createRigidBody(
      { shape: { shape: 'BOX', dimensions: { x: 10, y: 10, z: 0.5 } }, body: { dynamic: false, mass: 0 } },
      { position: { x: 0, y: 0, z: -0.1 }, rotation: Qtrn.fromAngle({ x: 0, y: 1, z: 0 }, rampAngle) },
    );
    ramp.addToWorld({ physicsWorld: world } as any);

    const character = factory.createCharacterController(
      { radius: 0.4, centersDistance: 1.0 },
      { position: { x: 0, y: 0, z: 3 } },
    );
    character.addToWorld({ physicsWorld: world } as any);
    settleWorld();

    // press the character straight down onto the steep ramp repeatedly, the same way gravity alone
    // would (`CharacterController3dEntity` never reports this ground as walkable - see
    // `isWalkableGround` - so it keeps integrating gravity instead of resting, exactly mimicking
    // this loop)
    const startX = character.position.x;
    for (let i = 0; i < 60; i++) {
      character.move({ x: 0, y: 0, z: -0.1 });
    }

    expect(character.isGrounded).toBe(false);
    // must have actually slid sideways off the ramp's face, not just sat there pressed against it
    expect(Math.abs(character.position.x - startX)).toBeGreaterThan(0.3);
  });

  it('clone() produces an independent, working character controller', () => {
    const floor = createFloor(factory, 0);
    floor.addToWorld({ physicsWorld: world } as any);

    const character = factory.createCharacterController(
      { radius: 0.4, centersDistance: 1.0 },
      { position: { x: 0, y: 0, z: 1.0 } },
    );
    character.addToWorld({ physicsWorld: world } as any);
    settleWorld();

    const clone = character.clone();
    expect(clone).not.toBe(character);
    expect(clone.radius).toBe(character.radius);
    expect(clone.centersDistance).toBe(character.centersDistance);
    clone.addToWorld({ physicsWorld: world } as any);
    settleWorld();

    clone.move({ x: 0, y: 0, z: -5 });
    expect(clone.isGrounded).toBe(true);
    expect(clone.position.z).toBeGreaterThan(0.85);
    expect(clone.position.z).toBeLessThan(0.95);
  });
});
