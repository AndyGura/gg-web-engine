import { CharacterController2dEntity, Gg2dWorld, Pnt2, Point2 } from '../../../src';
import { mockCharacterController2d } from '../../mocks/character-controller-2d.mock';
import { mock2DObject } from '../../mocks/object.mock';

const expectCloseVector = (actual: Point2, expected: Point2) => {
  expect(actual.x).toBeCloseTo(expected.x);
  expect(actual.y).toBeCloseTo(expected.y);
};

describe('CharacterController2dEntity', () => {
  describe('constructor', () => {
    it('pulls position and rotation from the character controller immediately', () => {
      const cc = mockCharacterController2d();
      cc.position = { x: 1, y: 2 };
      cc.rotation = 1.5;
      const entity = new CharacterController2dEntity({ radius: 0.4, centersDistance: 1 }, null, cc);
      expect(entity.position).toEqual({ x: 1, y: 2 });
      expect(entity.rotation).toEqual(1.5);
    });

    it('defaults crouchCentersDistance to 60% of the standing centersDistance', () => {
      const entity = new CharacterController2dEntity(
        { radius: 0.4, centersDistance: 1 },
        null,
        mockCharacterController2d(),
      );
      expect(entity.options.crouchCentersDistance).toBeCloseTo(0.6);
    });
  });

  describe('movement', () => {
    it('scales moveDirection by walkSpeed along the right axis (perpendicular to `up`)', () => {
      const cc = mockCharacterController2d();
      const entity = new CharacterController2dEntity({ radius: 0.4, centersDistance: 1, walkSpeed: 4 }, null, cc);
      entity.onSpawned({} as any);
      const moveSpy = jest.spyOn(cc, 'move');
      entity.moveDirection = 1; // default up is {x:0,y:-1}, so right is {x:1,y:0}
      entity.tick$.next([1000, 1000]); // 1 second
      expectCloseVector(moveSpy.mock.calls[0][0], { x: 4, y: 0 });
    });

    it('moves the other way along the right axis when moveDirection is negative', () => {
      const cc = mockCharacterController2d();
      const entity = new CharacterController2dEntity({ radius: 0.4, centersDistance: 1, walkSpeed: 4 }, null, cc);
      entity.onSpawned({} as any);
      const moveSpy = jest.spyOn(cc, 'move');
      entity.moveDirection = -1;
      entity.tick$.next([1000, 1000]);
      expectCloseVector(moveSpy.mock.calls[0][0], { x: -4, y: 0 });
      expect(entity.facing).toBe(-1);
    });

    it('scales speed by runSpeedMultiplier while running', () => {
      const cc = mockCharacterController2d();
      const entity = new CharacterController2dEntity(
        { radius: 0.4, centersDistance: 1, walkSpeed: 4, runSpeedMultiplier: 2 },
        null,
        cc,
      );
      entity.onSpawned({} as any);
      const moveSpy = jest.spyOn(cc, 'move');
      entity.moveDirection = 1;
      entity.isRunning = true;
      entity.tick$.next([1000, 1000]);
      expectCloseVector(moveSpy.mock.calls[0][0], { x: 8, y: 0 });
    });

    it('scales speed by crouchSpeedMultiplier while crouching, overriding isRunning', () => {
      const cc = mockCharacterController2d();
      const entity = new CharacterController2dEntity(
        { radius: 0.4, centersDistance: 1, walkSpeed: 4, runSpeedMultiplier: 2, crouchSpeedMultiplier: 0.5 },
        null,
        cc,
      );
      entity.onSpawned({} as any);
      const moveSpy = jest.spyOn(cc, 'move');
      entity.moveDirection = 1;
      entity.isRunning = true;
      entity.isCrouching = true; // no physicsWorld yet, so this just flips the flag - no capsule swap
      entity.tick$.next([1000, 1000]);
      expectCloseVector(moveSpy.mock.calls[0][0], { x: 2, y: 0 });
    });

    it("carries the ground launch speed through the whole jump/fall arc, instead of throttling it once airborne", () => {
      const cc = mockCharacterController2d(0.4, 1, {
        resolveMove: d => ({ appliedTranslation: d, isGrounded: false }),
      });
      const entity = new CharacterController2dEntity(
        { radius: 0.4, centersDistance: 1, walkSpeed: 4, airControlFactor: 0.25, gravity: 0 },
        null,
        cc,
      );
      entity.onSpawned({} as any);
      entity.moveDirection = 1;
      const moveSpy = jest.spyOn(cc, 'move');
      entity.tick$.next([1000, 1000]); // takeoff tick: full ground speed, not yet throttled
      expect(moveSpy.mock.calls[0][0].x).toBeCloseTo(4);
      entity.tick$.next([2000, 1000]); // now airborne - same input, so momentum persists unchanged
      expect(moveSpy.mock.calls[1][0].x).toBeCloseTo(4);
    });

    it('limits how fast airControlFactor can redirect airborne velocity towards new input, rather than snapping to it', () => {
      const cc = mockCharacterController2d(0.4, 1, {
        resolveMove: d => ({ appliedTranslation: d, isGrounded: false }),
      });
      const entity = new CharacterController2dEntity(
        { radius: 0.4, centersDistance: 1, walkSpeed: 4, airControlFactor: 0.25, gravity: 0 },
        null,
        cc,
      );
      entity.onSpawned({} as any);
      entity.moveDirection = 1;
      entity.tick$.next([1000, 1000]); // still grounded this tick (mock's initial isGrounded), direct control
      entity.tick$.next([2000, 1000]); // now airborne: seeds carried velocity to {4, 0}
      entity.moveDirection = -1; // steer towards the opposite direction while airborne
      const moveSpy = jest.spyOn(cc, 'move');
      entity.tick$.next([3000, 1000]); // 1s tick: max steering delta = airControlFactor * speed * dt = 0.25 * 4 * 1 = 1
      const applied = moveSpy.mock.calls[0][0];
      expect(applied.x).toBeCloseTo(3); // nudged from 4 towards -4 by exactly 1 unit, not snapped
    });

    it('integrates gravity into vertical velocity while airborne', () => {
      const cc = mockCharacterController2d(0.4, 1, {
        resolveMove: d => ({ appliedTranslation: d, isGrounded: false }),
      });
      const entity = new CharacterController2dEntity({ radius: 0.4, centersDistance: 1, gravity: 10 }, null, cc);
      entity.onSpawned({} as any);
      const moveSpy = jest.spyOn(cc, 'move');
      entity.tick$.next([1000, 1000]); // 1s tick, starts grounded (stale) so gravity not applied yet
      expect(moveSpy.mock.calls[0][0].y).toBeCloseTo(0);
      entity.tick$.next([2000, 1000]); // now airborne - gravity applies (down = +y, since up is {0,-1})
      // a 1 s fall from rest: the velocity reaches g, the displacement is the exact ½·g·t²
      expect(moveSpy.mock.calls[1][0].y).toBeCloseTo(5);
    });

    it('follows physicsWorld.gravity when no `gravity` option is set, instead of a fixed downward pull', () => {
      const cc = mockCharacterController2d(0.4, 1, {
        resolveMove: d => ({ appliedTranslation: d, isGrounded: false }),
      });
      const entity = new CharacterController2dEntity({ radius: 0.4, centersDistance: 1 }, null, cc);
      entity.onSpawned({ physicsWorld: { gravity: { x: 0, y: 20 } } } as any);
      const moveSpy = jest.spyOn(cc, 'move');
      entity.tick$.next([1000, 1000]);
      expect(moveSpy.mock.calls[0][0].y).toBeCloseTo(0);
      entity.tick$.next([2000, 1000]); // now airborne - matches the world's 20, not a hardcoded default
      expect(moveSpy.mock.calls[1][0].y).toBeCloseTo(10);
    });

    it('falls upward, not downward, when physicsWorld.gravity itself points along +up (regression: used to always fall down regardless of the world gravity vector)', () => {
      const cc = mockCharacterController2d(0.4, 1, {
        resolveMove: d => ({ appliedTranslation: d, isGrounded: false }),
      });
      const entity = new CharacterController2dEntity({ radius: 0.4, centersDistance: 1 }, null, cc);
      entity.onSpawned({ physicsWorld: { gravity: { x: 0, y: -20 } } } as any);
      const moveSpy = jest.spyOn(cc, 'move');
      entity.tick$.next([1000, 1000]);
      entity.tick$.next([2000, 1000]); // should accelerate along -y (up), following the world
      expect(moveSpy.mock.calls[1][0].y).toBeLessThan(0);
    });

    it('keeps integrating gravity even while nominally grounded, if gravity flips to pull away from the surface underfoot (regression: got stuck floating in place against the floor instead of falling away from it)', () => {
      // this mock stays reported `isGrounded: true` no matter what - simulating a character resting
      // on a floor whose contact never breaks on its own
      const cc = mockCharacterController2d();
      const entity = new CharacterController2dEntity({ radius: 0.4, centersDistance: 1 }, null, cc);
      entity.onSpawned({ physicsWorld: { gravity: { x: 0, y: -9.82 } } } as any);
      const moveSpy = jest.spyOn(cc, 'move');
      entity.tick$.next([1000, 1000]);
      expect(moveSpy.mock.calls[0][0].y).toBeLessThan(0); // must start accelerating away immediately
    });

    it('an explicit `gravity` option still overrides physicsWorld.gravity', () => {
      const cc = mockCharacterController2d(0.4, 1, {
        resolveMove: d => ({ appliedTranslation: d, isGrounded: false }),
      });
      const entity = new CharacterController2dEntity({ radius: 0.4, centersDistance: 1, gravity: 5 }, null, cc);
      entity.onSpawned({ physicsWorld: { gravity: { x: 0, y: 999 } } } as any);
      const moveSpy = jest.spyOn(cc, 'move');
      entity.tick$.next([1000, 1000]);
      entity.tick$.next([2000, 1000]);
      expect(moveSpy.mock.calls[1][0].y).toBeCloseTo(2.5);
    });

    it('drags the character along a horizontal gravity component too, not just its component along `up` (regression: only the vertical component of a tilted gravity vector was ever applied)', () => {
      const cc = mockCharacterController2d(0.4, 1, {
        resolveMove: d => ({ appliedTranslation: d, isGrounded: false }),
      });
      const entity = new CharacterController2dEntity({ radius: 0.4, centersDistance: 1 }, null, cc);
      entity.onSpawned({ physicsWorld: { gravity: { x: 6, y: 20 } } } as any);
      const moveSpy = jest.spyOn(cc, 'move');
      entity.tick$.next([1000, 1000]);
      entity.tick$.next([2000, 1000]); // now airborne - both components of gravity must integrate
      expect(moveSpy.mock.calls[1][0].y).toBeCloseTo(10);
      expect(moveSpy.mock.calls[1][0].x).toBeCloseTo(3);
    });

    it('slides down (keeps integrating gravity) instead of resting, when grounded against a surface steeper than maxSlopeClimbAngleRad', () => {
      // reports grounded with a near-horizontal ground normal - far steeper than the default
      // ~50deg limit - simulating a character balanced at the edge of a curved surface
      const cc = mockCharacterController2d(0.4, 1, {
        resolveMove: d => ({ appliedTranslation: d, isGrounded: true, groundNormal: { x: 1, y: -0.05 } }),
      });
      const entity = new CharacterController2dEntity({ radius: 0.4, centersDistance: 1 }, null, cc);
      entity.onSpawned({ physicsWorld: { gravity: { x: 0, y: 10 } } } as any);
      const moveSpy = jest.spyOn(cc, 'move');
      entity.tick$.next([1000, 1000]);
      entity.tick$.next([2000, 1000]); // still "isGrounded", but the surface is unwalkably steep
      expect(moveSpy.mock.calls[1][0].y).toBeGreaterThan(0);
    });

    it('does not slide while grounded on an ordinary walkable surface, even one tilted within maxSlopeClimbAngleRad', () => {
      const cc = mockCharacterController2d(0.4, 1, {
        resolveMove: d => ({ appliedTranslation: d, isGrounded: true, groundNormal: Pnt2.nY }),
      });
      const entity = new CharacterController2dEntity({ radius: 0.4, centersDistance: 1 }, null, cc);
      entity.onSpawned({ physicsWorld: { gravity: { x: 0, y: 10 } } } as any);
      const moveSpy = jest.spyOn(cc, 'move');
      entity.tick$.next([1000, 1000]);
      entity.tick$.next([2000, 1000]);
      expect(moveSpy.mock.calls[1][0].y).toBeCloseTo(0);
    });
  });

  describe('jump', () => {
    it('sets vertical velocity only while grounded', () => {
      const cc = mockCharacterController2d(0.4, 1, {}, true);
      const entity = new CharacterController2dEntity({ radius: 0.4, centersDistance: 1, jumpSpeed: 5 }, null, cc);
      entity.onSpawned({} as any);
      entity.jump();
      const moveSpy = jest.spyOn(cc, 'move');
      entity.tick$.next([1000, 100]); // 0.1s
      expect(moveSpy.mock.calls[0][0].y).toBeCloseTo(-0.5); // jump goes along -y (up), 5 units/s * 0.1s
    });

    it("cancels upward velocity immediately on hitting a ceiling, instead of coasting through the rest of an unobstructed jump arc before falling", () => {
      // simulates a ceiling: any upward (negative y) desired translation is fully blocked
      const cc = mockCharacterController2d(0.4, 1, {
        resolveMove: d => ({
          appliedTranslation: { x: d.x, y: d.y < 0 ? 0 : d.y },
          isGrounded: false,
          groundNormal: null,
        }),
      });
      const entity = new CharacterController2dEntity(
        { radius: 0.4, centersDistance: 1, jumpSpeed: 5, gravity: 10 },
        null,
        cc,
      );
      entity.onSpawned({} as any);
      entity.jump(); // grounded (mock's initial isGrounded), takes off
      const moveSpy = jest.spyOn(cc, 'move');
      entity.tick$.next([1000, 100]); // 0.1s: rises, then immediately hits the ceiling, fully blocked
      expect(moveSpy.mock.calls[0][0].y).toBeCloseTo(-0.45); // desired takeoff translation: 5 * 0.1 - ½ * 10 * 0.1²
      entity.tick$.next([2000, 100]); // next tick: upward velocity cancelled, gravity pulls down (+y)
      expect(moveSpy.mock.calls[1][0].y).toBeGreaterThan(0);
    });

    it('is a no-op mid-air', () => {
      const cc = mockCharacterController2d(0.4, 1, {
        resolveMove: d => ({ appliedTranslation: d, isGrounded: false }),
      });
      const entity = new CharacterController2dEntity(
        { radius: 0.4, centersDistance: 1, jumpSpeed: 5, gravity: 0 },
        null,
        cc,
      );
      entity.onSpawned({} as any);
      entity.tick$.next([1000, 1000]); // becomes airborne
      entity.jump(); // should be ignored: character reports isGrounded === false now
      const moveSpy = jest.spyOn(cc, 'move');
      entity.tick$.next([2000, 100]);
      expect(moveSpy.mock.calls[0][0].y).toBeCloseTo(0);
    });
  });

  describe('object2D sync', () => {
    it('mirrors the resolved position/rotation onto the sprite after move()', () => {
      const cc = mockCharacterController2d();
      const sprite = mock2DObject();
      const entity = new CharacterController2dEntity({ radius: 0.4, centersDistance: 1, walkSpeed: 4 }, sprite, cc);
      entity.onSpawned({} as any);
      entity.moveDirection = 1;
      entity.tick$.next([1000, 1000]);
      expectCloseVector(sprite.position, entity.position);
    });
  });

  describe('crouch', () => {
    const setupSpawnedEntity = () => {
      const visualScene = { factory: { createSprite: jest.fn(() => mock2DObject()) }, dispose: () => {} };
      const createdControllers: ReturnType<typeof mockCharacterController2d>[] = [];
      const physicsWorld = {
        factory: {
          createCharacterController: jest.fn((options: any, transform: any) => {
            const created = mockCharacterController2d(options.radius, options.centersDistance);
            created.position = transform.position;
            created.rotation = transform.rotation;
            createdControllers.push(created);
            return created;
          }),
        },
        raycast: jest.fn((): any => ({ hasHit: false })),
        dispose: () => {},
      };
      const world = new Gg2dWorld({ visualScene: visualScene as any, physicsWorld: physicsWorld as any });
      const initialCc = mockCharacterController2d(0.4, 1);
      initialCc.position = { x: 0, y: -0.9 }; // feet at y=0 (radius 0.4 + centersDistance/2 0.5, up is -Y)
      const entity = new CharacterController2dEntity(
        { radius: 0.4, centersDistance: 1, crouchCentersDistance: 0.5 },
        null,
        initialCc,
      );
      world.addEntity(entity);
      return { entity, physicsWorld, createdControllers };
    };

    it('crouching down recreates the capsule at a shorter height with feet held in place', () => {
      const { entity, physicsWorld } = setupSpawnedEntity();
      entity.isCrouching = true;
      expect(entity.isCrouching).toBe(true);
      expect(physicsWorld.factory.createCharacterController).toHaveBeenCalledTimes(1);
      const [, transform] = physicsWorld.factory.createCharacterController.mock.calls[0];
      // feet were at y=0; crouching with crouchCentersDistance=0.5 -> new center at -(radius+0.25)=-0.65
      expect(transform.position.y).toBeCloseTo(-0.65);
    });

    it('standing up is blocked by a raycast hit and retried until clear', () => {
      const { entity, physicsWorld } = setupSpawnedEntity();
      entity.isCrouching = true;
      physicsWorld.raycast.mockReturnValue({ hasHit: true, hitDistance: 0.1 });

      entity.isCrouching = false;
      expect(entity.isCrouching).toBe(true); // still crouched, headroom blocked
      expect(physicsWorld.factory.createCharacterController).toHaveBeenCalledTimes(1); // no new capsule yet

      physicsWorld.raycast.mockReturnValue({ hasHit: false });
      entity.tick$.next([1000, 16]); // retried automatically on tick
      expect(entity.isCrouching).toBe(false);
      expect(physicsWorld.factory.createCharacterController).toHaveBeenCalledTimes(2);
    });
  });

  describe('momentum accessors', () => {
    it('exposes fallVelocity/airHorizontalVelocity as independent read/write properties, and velocity as their read-only sum', () => {
      const entity = new CharacterController2dEntity(
        { radius: 0.4, centersDistance: 1 },
        null,
        mockCharacterController2d(),
      );
      expect(entity.velocity).toEqual(Pnt2.O);

      entity.fallVelocity = { x: 0, y: 5 };
      expect(entity.fallVelocity).toEqual({ x: 0, y: 5 });
      expect(entity.airHorizontalVelocity).toEqual(Pnt2.O);
      expect(entity.velocity).toEqual({ x: 0, y: 5 });

      entity.airHorizontalVelocity = { x: 2, y: 0 };
      expect(entity.fallVelocity).toEqual({ x: 0, y: 5 });
      expect(entity.velocity).toEqual({ x: 2, y: 5 });
    });
  });
});
