import { CharacterController3dOptions, Pnt3 } from '@gg-web-engine/core';
import { Rapier3dFactory, Rapier3dWorldComponent } from '../../src';

describe('Rapier3dCharacterControllerComponent', () => {
  let world: Rapier3dWorldComponent;
  let factory: Rapier3dFactory;

  beforeEach(async () => {
    if (world) {
      world.dispose();
    }
    world = new Rapier3dWorldComponent();
    factory = new Rapier3dFactory(world);
    await world.init();
    world.gravity = Pnt3.O; // this component never relies on gravity - see the class doc
  });

  afterAll(() => {
    world.dispose();
  });

  const CHAR_OPTIONS: CharacterController3dOptions = { radius: 0.4, centersDistance: 1.0 };
  // center-to-feet distance for the capsule above: radius + centersDistance / 2
  const HALF_HEIGHT = CHAR_OPTIONS.radius + CHAR_OPTIONS.centersDistance / 2;

  // A static floor slab spanning [centerX - sizeX/2, centerX + sizeX/2] on X, with its top face at
  // world-space `topZ`.
  const addFloor = (centerX: number, sizeX: number, topZ: number, thickness = 1) => {
    const floor = factory.createRigidBody(
      {
        shape: { shape: 'BOX', dimensions: { x: sizeX, y: 20, z: thickness } },
        body: { dynamic: false, mass: 0 },
      },
      { position: { x: centerX, y: 0, z: topZ - thickness / 2 } },
    );
    floor.addToWorld({ physicsWorld: world } as any);
    return floor;
  };

  // A static vertical wall whose near face is at world-space X `x`.
  const addWall = (x: number, thickness = 1) => {
    const wall = factory.createRigidBody(
      {
        shape: { shape: 'BOX', dimensions: { x: thickness, y: 20, z: 5 } },
        body: { dynamic: false, mass: 0 },
      },
      { position: { x: x + thickness / 2, y: 0, z: 2.5 } },
    );
    wall.addToWorld({ physicsWorld: world } as any);
    return wall;
  };

  // Rapier only registers a freshly-created collider's AABB with its broad-phase as part of running
  // World.step() at least once (there is no manual "rebuild broad-phase now" call exposed on this
  // build of @dimforge/rapier3d-compat) - so a collider created and never stepped is invisible to
  // computeColliderMovement's sweep, exactly like it would be to a raycast (see
  // Rapier3dWorldComponent's own raycast tests, which all call world.simulate() first for the same
  // reason). A zero-length timestep step is enough to register geometry without moving anything, and
  // stands in for "the world/level was already running before this character got added" - the one
  // thing the synchronous `move()` contract does NOT need to hold is any *additional* simulate() call
  // in between/after move() calls, which is what the tests below actually exercise.
  const settleWorld = () => world.simulate(0);

  it('should create a character controller and add it to the world', () => {
    const character = factory.createCharacterController(CHAR_OPTIONS, { position: { x: 0, y: 0, z: 5 } });
    expect(character.radius).toBe(0.4);
    expect(character.centersDistance).toBe(1.0);
    character.addToWorld({ physicsWorld: world } as any);
    expect(world.children).toContain(character);
    expect(character.position).toEqual({ x: 0, y: 0, z: 5 });
  });

  it('should settle on a flat floor and report grounded state', () => {
    addFloor(0, 20, 0);
    const character = factory.createCharacterController(CHAR_OPTIONS, { position: { x: 0, y: 0, z: 5 } });
    character.addToWorld({ physicsWorld: world } as any);
    settleWorld();

    expect(character.isGrounded).toBe(false);

    character.move({ x: 0, y: 0, z: -10 });

    // resolved fully synchronously - no world.simulate() call happened after settleWorld() above
    expect(character.isGrounded).toBe(true);
    expect(character.position.z).toBeCloseTo(HALF_HEIGHT, 1);
    expect(character.groundNormal).not.toBeNull();
    expect(character.groundNormal!.z).toBeGreaterThan(0.9);
  });

  it('should slide to a stop against a wall instead of passing through it', () => {
    addFloor(0, 20, 0);
    addWall(2);
    const character = factory.createCharacterController(CHAR_OPTIONS, {
      position: { x: 0, y: 0, z: HALF_HEIGHT + 0.5 },
    });
    character.addToWorld({ physicsWorld: world } as any);
    settleWorld();
    // settle onto the floor first
    character.move({ x: 0, y: 0, z: -1 });
    expect(character.isGrounded).toBe(true);

    character.move({ x: 5, y: 0, z: 0 });

    // wall's near face is at x=2; the capsule (radius 0.4) plus its skin offset must stop short of it
    expect(character.position.x).toBeLessThan(1.6);
    expect(character.position.x).toBeGreaterThan(0.5);
    // remained grounded throughout - sliding along the wall, not falling
    expect(character.isGrounded).toBe(true);
  });

  it('should step up a ledge shorter than maxStepHeight without getting stuck', () => {
    const maxStepHeight = 0.3;
    const stepZ = 0.2; // below maxStepHeight
    addFloor(-5, 10, 0); // lower floor, spans x in [-10, 0]
    addFloor(5, 10, stepZ); // upper ledge, spans x in [0, 10], step wall at x=0

    const character = factory.createCharacterController(
      { ...CHAR_OPTIONS, maxStepHeight },
      { position: { x: -5, y: 0, z: HALF_HEIGHT + 0.5 } },
    );
    character.addToWorld({ physicsWorld: world } as any);
    settleWorld();
    character.move({ x: 0, y: 0, z: -1 });
    expect(character.isGrounded).toBe(true);
    expect(character.position.z).toBeCloseTo(HALF_HEIGHT, 1);

    // walk forward across the step in small increments, each with a slight downward bias so the
    // character does not need to rely on gravity (which this component never applies itself)
    for (let i = 0; i < 60; i++) {
      character.move({ x: 0.15, y: 0, z: -0.05 });
    }

    expect(character.isGrounded).toBe(true);
    expect(character.position.x).toBeGreaterThan(2); // made meaningful forward progress past the step
    expect(character.position.z).toBeCloseTo(stepZ + HALF_HEIGHT, 1); // stepped up onto the ledge
  });

  it('a small upward move (a jump takeoff tick) actually rises instead of being snapped back to the floor, even though it stays well within the default snapToGroundDistance of 0.3', () => {
    addFloor(0, 20, 0);
    const character = factory.createCharacterController(CHAR_OPTIONS, {
      position: { x: 0, y: 0, z: HALF_HEIGHT + 0.5 },
    });
    character.addToWorld({ physicsWorld: world } as any);
    settleWorld();
    character.move({ x: 0, y: 0, z: -1 });
    expect(character.isGrounded).toBe(true);
    const groundedZ = character.position.z;

    // one tick's worth of a typical jumpSpeed (5 m/s) at 60fps - well under the 0.3 snapToGroundDistance
    character.move({ x: 0, y: 0, z: 0.083 });

    expect(character.position.z).toBeCloseTo(groundedZ + 0.083, 2);
    expect(character.isGrounded).toBe(false);
  });

  it("move()'s effects must be visible immediately, without an extra world.step() in between", () => {
    addFloor(0, 20, 0);
    addWall(1);
    const character = factory.createCharacterController(CHAR_OPTIONS, {
      position: { x: 0, y: 0, z: HALF_HEIGHT + 0.01 },
    });
    character.addToWorld({ physicsWorld: world } as any);
    settleWorld();

    // no world.simulate() call below this point - move() alone must fully resolve state
    character.move({ x: 10, y: 0, z: 0 });

    expect(character.position.x).toBeLessThan(0.6);
    expect(character.position.x).toBeGreaterThan(-0.1);
  });

  it('should clone with the same shape/options but independent from the world', () => {
    const character = factory.createCharacterController(
      { radius: 0.3, centersDistance: 0.8, maxStepHeight: 0.25 },
      { position: { x: 1, y: 2, z: 3 } },
    );
    const clone = character.clone();
    expect(clone.radius).toBe(character.radius);
    expect(clone.centersDistance).toBe(character.centersDistance);
    expect(clone.position).toEqual(character.position);
    expect(clone.nativeBody).toBeNull();
  });

  it('should clone from the CURRENT position/rotation, not the construction-time spawn point', () => {
    const character = factory.createCharacterController(CHAR_OPTIONS, { position: { x: 0, y: 0, z: 5 } });
    character.addToWorld({ physicsWorld: world } as any);
    settleWorld();
    // move the character away from its construction-time position via the position setter, the
    // same code path that leaves `_bodyDescr` stale once `_nativeBody` exists
    character.position = { x: 10, y: 20, z: 30 };

    const clone = character.clone();

    expect(clone.position).toEqual(character.position);
    expect(clone.position).not.toEqual({ x: 0, y: 0, z: 5 });
  });

  it('move() before addToWorld() should be a silent no-op, not throw', () => {
    const character = factory.createCharacterController(CHAR_OPTIONS, { position: { x: 0, y: 0, z: 5 } });
    expect(() => character.move({ x: 1, y: 0, z: 0 })).not.toThrow();
    expect(character.position).toEqual({ x: 0, y: 0, z: 5 });
  });

  it('should normalize a non-unit-length up vector, matching the Ammo adapter', () => {
    const character = factory.createCharacterController(
      { ...CHAR_OPTIONS, up: { x: 0, y: 0, z: 2 } },
      { position: { x: 0, y: 0, z: 5 } },
    );
    expect(character.up).toEqual({ x: 0, y: 0, z: 1 });

    character.up = { x: 0, y: 0, z: 3 };
    expect(character.up).toEqual({ x: 0, y: 0, z: 1 });
  });
});
