import { CharacterController2dOptions, Pnt2 } from '@gg-web-engine/core';
import { Rapier2dFactory, Rapier2dWorldComponent } from '../../src';

describe('Rapier2dCharacterControllerComponent', () => {
  let world: Rapier2dWorldComponent;
  let factory: Rapier2dFactory;

  beforeEach(async () => {
    if (world) {
      world.dispose();
    }
    world = new Rapier2dWorldComponent();
    factory = new Rapier2dFactory(world);
    await world.init();
    world.gravity = Pnt2.O; // this component never relies on gravity - see the class doc
  });

  afterAll(() => {
    world.dispose();
  });

  const CHAR_OPTIONS: CharacterController2dOptions = { radius: 0.4, centersDistance: 1.0 };
  // center-to-feet distance for the capsule above: radius + centersDistance / 2
  const HALF_HEIGHT = CHAR_OPTIONS.radius + CHAR_OPTIONS.centersDistance / 2;

  // A static floor slab spanning [centerX - sizeX/2, centerX + sizeX/2] on X, with its top face (the
  // side facing `up` = `{x:0,y:-1}`, i.e. the smaller-Y side) at world-space `topY`.
  const addFloor = (centerX: number, sizeX: number, topY: number, thickness = 1) => {
    const floor = factory.createRigidBody(
      {
        shape: { shape: 'BOX', dimensions: { x: sizeX, y: thickness } },
        body: { bodyType: 'static', mass: 0 },
      },
      { position: { x: centerX, y: topY + thickness / 2 } },
    );
    floor.addToWorld({ physicsWorld: world } as any);
    return floor;
  };

  // A static vertical wall whose near face is at world-space X `x`.
  const addWall = (x: number, thickness = 1) => {
    const wall = factory.createRigidBody(
      {
        shape: { shape: 'BOX', dimensions: { x: thickness, y: 20 } },
        body: { bodyType: 'static', mass: 0 },
      },
      { position: { x: x + thickness / 2, y: 0 } },
    );
    wall.addToWorld({ physicsWorld: world } as any);
    return wall;
  };

  // see Rapier3dCharacterControllerComponent's own test suite for why this is needed - a freshly
  // created collider only enters Rapier's broad-phase as part of a World.step().
  const settleWorld = () => world.simulate(0);

  it('should create a character controller and add it to the world', () => {
    const character = factory.createCharacterController(CHAR_OPTIONS, { position: { x: 0, y: -5 } });
    expect(character.radius).toBe(0.4);
    expect(character.centersDistance).toBe(1.0);
    character.addToWorld({ physicsWorld: world } as any);
    expect(world.children).toContain(character);
    expect(character.position).toEqual({ x: 0, y: -5 });
  });

  it('should settle on a flat floor and report grounded state', () => {
    addFloor(0, 20, 0);
    const character = factory.createCharacterController(CHAR_OPTIONS, { position: { x: 0, y: -5 } });
    character.addToWorld({ physicsWorld: world } as any);
    settleWorld();

    expect(character.isGrounded).toBe(false);

    character.move({ x: 0, y: 10 });

    // resolved fully synchronously - no world.simulate() call happened after settleWorld() above
    expect(character.isGrounded).toBe(true);
    expect(character.position.y).toBeCloseTo(-HALF_HEIGHT, 1);
    expect(character.groundNormal).not.toBeNull();
    expect(character.groundNormal!.y).toBeLessThan(-0.9);
  });

  it('reports the real (steep) contact normal when resting against the flank of a circle, not a flattened `up`', () => {
    // A circle resting on the floor, center at (0,-1) - the character is placed a hair above the
    // point on its flank at x=1.2 (well off the apex) and nudged down by a small amount, landing on
    // a contact whose true outward normal is steep (~59° off `up`), not flat.
    addFloor(0, 20, 0);
    const circle = factory.createRigidBody(
      { shape: { shape: 'CIRCLE', radius: 1 }, body: { bodyType: 'static', mass: 0 } },
      { position: { x: 0, y: -1 } },
    );
    circle.addToWorld({ physicsWorld: world } as any);
    // touching distance between capsule (radius 0.4) and circle (radius 1) centers is 1.4; at
    // dx=1.2, dy = sqrt(1.4^2 - 1.2^2) ~= 0.721, so the capsule center touches at y ~= -1.73
    const character = factory.createCharacterController(CHAR_OPTIONS, { position: { x: 1.2, y: -1.73 } });
    character.addToWorld({ physicsWorld: world } as any);
    settleWorld();

    character.move({ x: 0, y: 0.05 });

    expect(character.isGrounded).toBe(true);
    expect(character.groundNormal).not.toBeNull();
    expect(character.groundNormal!.y).toBeLessThan(-0.1);
    expect(character.groundNormal!.y).toBeGreaterThan(-0.6);
  });

  it('should slide to a stop against a wall instead of passing through it', () => {
    addFloor(0, 20, 0);
    addWall(2);
    const character = factory.createCharacterController(CHAR_OPTIONS, {
      position: { x: 0, y: -(HALF_HEIGHT + 0.5) },
    });
    character.addToWorld({ physicsWorld: world } as any);
    settleWorld();
    // settle onto the floor first
    character.move({ x: 0, y: 1 });
    expect(character.isGrounded).toBe(true);

    character.move({ x: 5, y: 0 });

    // wall's near face is at x=2; the capsule (radius 0.4) plus its skin offset must stop short of it
    expect(character.position.x).toBeLessThan(1.6);
    expect(character.position.x).toBeGreaterThan(0.5);
    // remained grounded throughout - sliding along the wall, not falling
    expect(character.isGrounded).toBe(true);
  });

  it(
    'walks straight through a body added to ignoredBodies instead of sliding to a stop against it ' +
      "(regression: collision groups alone can't express excluding just one specific body while both " +
      'it and the character still need to collide with the rest of the world - see ' +
      '`ICharacterController2dComponent.ignoredBodies`\'s doc)',
    () => {
      addFloor(0, 20, 0);
      const wall = addWall(2);
      const character = factory.createCharacterController(CHAR_OPTIONS, {
        position: { x: 0, y: -(HALF_HEIGHT + 0.5) },
      });
      character.addToWorld({ physicsWorld: world } as any);
      character.ignoredBodies.add(wall);
      settleWorld();
      character.move({ x: 0, y: 1 });

      character.move({ x: 5, y: 0 });

      // unlike the baseline test above, nothing stopped it short of the wall's x=2 near face
      expect(character.position.x).toBeCloseTo(5);
    },
  );

  it('removing a body from ignoredBodies makes it block the character again', () => {
    addFloor(0, 20, 0);
    const wall = addWall(2);
    const character = factory.createCharacterController(CHAR_OPTIONS, {
      position: { x: 0, y: -(HALF_HEIGHT + 0.5) },
    });
    character.addToWorld({ physicsWorld: world } as any);
    character.ignoredBodies.add(wall);
    character.ignoredBodies.delete(wall);
    settleWorld();
    character.move({ x: 0, y: 1 });

    character.move({ x: 5, y: 0 });

    expect(character.position.x).toBeLessThan(1.6);
  });

  it('should step up a ledge shorter than maxStepHeight without getting stuck', () => {
    const maxStepHeight = 0.3;
    const stepHeight = 0.2; // below maxStepHeight
    addFloor(-5, 10, 0); // lower floor, spans x in [-10, 0]
    addFloor(5, 10, -stepHeight); // upper ledge, spans x in [0, 10], step wall at x=0

    const character = factory.createCharacterController(
      { ...CHAR_OPTIONS, maxStepHeight },
      { position: { x: -5, y: -(HALF_HEIGHT + 0.5) } },
    );
    character.addToWorld({ physicsWorld: world } as any);
    settleWorld();
    character.move({ x: 0, y: 1 });
    expect(character.isGrounded).toBe(true);
    expect(character.position.y).toBeCloseTo(-HALF_HEIGHT, 1);

    // walk forward across the step in small increments, each with a slight downward bias so the
    // character does not need to rely on gravity (which this component never applies itself)
    for (let i = 0; i < 60; i++) {
      character.move({ x: 0.15, y: 0.05 });
    }

    expect(character.isGrounded).toBe(true);
    expect(character.position.x).toBeGreaterThan(2); // made meaningful forward progress past the step
    expect(character.position.y).toBeCloseTo(-(stepHeight + HALF_HEIGHT), 1); // stepped up onto the ledge
  });

  it('a small upward move (a jump takeoff tick) actually rises instead of being snapped back to the floor, even though it stays well within the default snapToGroundDistance of 0.3', () => {
    addFloor(0, 20, 0);
    const character = factory.createCharacterController(CHAR_OPTIONS, {
      position: { x: 0, y: -(HALF_HEIGHT + 0.5) },
    });
    character.addToWorld({ physicsWorld: world } as any);
    settleWorld();
    character.move({ x: 0, y: 1 });
    expect(character.isGrounded).toBe(true);
    const groundedY = character.position.y;

    // one tick's worth of a typical jumpSpeed (5 units/s) at 60fps - well under the 0.3 snapToGroundDistance
    character.move({ x: 0, y: -0.083 });

    expect(character.position.y).toBeCloseTo(groundedY - 0.083, 2);
    expect(character.isGrounded).toBe(false);
  });

  it("move()'s effects must be visible immediately, without an extra world.step() in between", () => {
    addFloor(0, 20, 0);
    addWall(1);
    const character = factory.createCharacterController(CHAR_OPTIONS, {
      position: { x: 0, y: -(HALF_HEIGHT + 0.01) },
    });
    character.addToWorld({ physicsWorld: world } as any);
    settleWorld();

    // no world.simulate() call below this point - move() alone must fully resolve state
    character.move({ x: 10, y: 0 });

    expect(character.position.x).toBeLessThan(0.6);
    expect(character.position.x).toBeGreaterThan(-0.1);
  });

  it('should clone with the same shape/options but independent from the world', () => {
    const character = factory.createCharacterController(
      { radius: 0.3, centersDistance: 0.8, maxStepHeight: 0.25 },
      { position: { x: 1, y: 2 } },
    );
    const clone = character.clone();
    expect(clone.radius).toBe(character.radius);
    expect(clone.centersDistance).toBe(character.centersDistance);
    expect(clone.position).toEqual(character.position);
    expect(clone.nativeBody).toBeNull();
  });

  it('should clone from the CURRENT position/rotation, not the construction-time spawn point', () => {
    const character = factory.createCharacterController(CHAR_OPTIONS, { position: { x: 0, y: -5 } });
    character.addToWorld({ physicsWorld: world } as any);
    settleWorld();
    // move the character away from its construction-time position via the position setter, the
    // same code path that leaves `_bodyDescr` stale once `_nativeBody` exists
    character.position = { x: 10, y: 20 };

    const clone = character.clone();

    expect(clone.position).toEqual(character.position);
    expect(clone.position).not.toEqual({ x: 0, y: -5 });
  });

  it('move() before addToWorld() should be a silent no-op, not throw', () => {
    const character = factory.createCharacterController(CHAR_OPTIONS, { position: { x: 0, y: -5 } });
    expect(() => character.move({ x: 1, y: 0 })).not.toThrow();
    expect(character.position).toEqual({ x: 0, y: -5 });
  });

  it('should normalize a non-unit-length up vector, matching the 3D adapter', () => {
    const character = factory.createCharacterController(
      { ...CHAR_OPTIONS, up: { x: 0, y: 2 } },
      { position: { x: 0, y: -5 } },
    );
    expect(character.up).toEqual({ x: 0, y: 1 });

    character.up = { x: 0, y: 3 };
    expect(character.up).toEqual({ x: 0, y: 1 });
  });
});
