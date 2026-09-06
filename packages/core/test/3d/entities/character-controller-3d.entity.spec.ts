import { CharacterController3dEntity, Gg3dWorld, Pnt3, Point3, Qtrn } from '../../../src';
import { mockCharacterController } from '../../mocks/character-controller.mock';
import { mock3DObject } from '../../mocks/object.mock';

const expectCloseVector = (actual: Point3, expected: Point3) => {
  expect(actual.x).toBeCloseTo(expected.x);
  expect(actual.y).toBeCloseTo(expected.y);
  expect(actual.z).toBeCloseTo(expected.z);
};

describe('CharacterController3dEntity', () => {
  describe('constructor', () => {
    it('pulls position and rotation from the character controller immediately', () => {
      const cc = mockCharacterController();
      cc.position = { x: 1, y: 2, z: 3 };
      cc.rotation = { x: 0, y: 0, z: 1, w: 0 };
      const entity = new CharacterController3dEntity({ radius: 0.4, centersDistance: 1 }, null, cc);
      expect(entity.position).toEqual({ x: 1, y: 2, z: 3 });
      expect(entity.rotation).toEqual({ x: 0, y: 0, z: 1, w: 0 });
    });

    it('defaults crouchCentersDistance to 60% of the standing centersDistance', () => {
      const entity = new CharacterController3dEntity({ radius: 0.4, centersDistance: 1 }, null, mockCharacterController());
      expect(entity.options.crouchCentersDistance).toBeCloseTo(0.6);
    });
  });

  describe('movement', () => {
    it('rotates local moveDirection by yaw and scales it by walkSpeed', () => {
      const cc = mockCharacterController();
      const entity = new CharacterController3dEntity({ radius: 0.4, centersDistance: 1, walkSpeed: 4 }, null, cc);
      entity.onSpawned({} as any);
      const moveSpy = jest.spyOn(cc, 'move');
      entity.moveDirection = { x: 1, y: 0, z: 0 }; // local right (+X), identity rotation
      entity.tick$.next([1000, 1000]); // 1 second
      expectCloseVector(moveSpy.mock.calls[0][0], { x: 4, y: 0, z: 0 });
    });

    it('respects yaw rotation when computing world-space movement', () => {
      const cc = mockCharacterController();
      const entity = new CharacterController3dEntity({ radius: 0.4, centersDistance: 1, walkSpeed: 2 }, null, cc);
      entity.rotation = Qtrn.fromAngle(Pnt3.Z, Math.PI / 2); // yaw 90° around the up axis
      entity.onSpawned({} as any);
      const moveSpy = jest.spyOn(cc, 'move');
      entity.moveDirection = { x: 1, y: 0, z: 0 }; // local right (+X) - horizontal, not on the rotation axis
      entity.tick$.next([1000, 1000]);
      const applied = moveSpy.mock.calls[0][0];
      expect(applied.z).toBeCloseTo(0); // stays horizontal
      expect(Pnt3.len(applied)).toBeCloseTo(2); // magnitude (speed * dt) preserved
      expect(applied.y).not.toBeCloseTo(0); // rotated away from the unrotated {x:2,y:0,z:0}
    });

    it('scales speed by runSpeedMultiplier while running', () => {
      const cc = mockCharacterController();
      const entity = new CharacterController3dEntity(
        { radius: 0.4, centersDistance: 1, walkSpeed: 4, runSpeedMultiplier: 2 },
        null,
        cc,
      );
      entity.onSpawned({} as any);
      const moveSpy = jest.spyOn(cc, 'move');
      entity.moveDirection = { x: 1, y: 0, z: 0 };
      entity.isRunning = true;
      entity.tick$.next([1000, 1000]);
      expectCloseVector(moveSpy.mock.calls[0][0], { x: 8, y: 0, z: 0 });
    });

    it('applies airControlFactor to horizontal speed while airborne', () => {
      const cc = mockCharacterController(0.4, 1, {
        resolveMove: d => ({ appliedTranslation: d, isGrounded: false }),
      });
      const entity = new CharacterController3dEntity(
        { radius: 0.4, centersDistance: 1, walkSpeed: 4, airControlFactor: 0.25, gravity: 0 },
        null,
        cc,
      );
      entity.onSpawned({} as any);
      entity.moveDirection = { x: 1, y: 0, z: 0 };
      entity.tick$.next([1000, 1000]); // becomes airborne after this tick
      const moveSpy = jest.spyOn(cc, 'move');
      entity.tick$.next([2000, 1000]);
      expect(moveSpy.mock.calls[0][0].x).toBeCloseTo(1); // 4 * 0.25
    });

    it('integrates gravity into vertical velocity while airborne', () => {
      const cc = mockCharacterController(0.4, 1, {
        resolveMove: d => ({ appliedTranslation: d, isGrounded: false }),
      });
      const entity = new CharacterController3dEntity({ radius: 0.4, centersDistance: 1, gravity: 10 }, null, cc);
      entity.onSpawned({} as any);
      const moveSpy = jest.spyOn(cc, 'move');
      entity.tick$.next([1000, 1000]); // 1s tick, starts grounded (stale) so gravity not applied yet this tick
      expect(moveSpy.mock.calls[0][0].z).toBeCloseTo(0);
      entity.tick$.next([2000, 1000]); // now airborne (from previous move's result) - gravity applies
      expect(moveSpy.mock.calls[1][0].z).toBeCloseTo(-10);
    });

    it('follows physicsWorld.gravity when no `gravity` option is set, instead of a fixed downward pull', () => {
      const cc = mockCharacterController(0.4, 1, {
        resolveMove: d => ({ appliedTranslation: d, isGrounded: false }),
      });
      // no `gravity` option here - must be derived live from the world every tick
      const entity = new CharacterController3dEntity({ radius: 0.4, centersDistance: 1 }, null, cc);
      entity.onSpawned({ physicsWorld: { gravity: { x: 0, y: 0, z: -20 } } } as any);
      const moveSpy = jest.spyOn(cc, 'move');
      entity.tick$.next([1000, 1000]); // starts grounded (stale) so gravity not applied yet this tick
      expect(moveSpy.mock.calls[0][0].z).toBeCloseTo(0);
      entity.tick$.next([2000, 1000]); // now airborne - gravity applies, matching the world's -20, not a hardcoded 9.82
      expect(moveSpy.mock.calls[1][0].z).toBeCloseTo(-20);
    });

    it('falls upward, not downward, when physicsWorld.gravity itself points along +up (regression: used to always fall -Z regardless of the world gravity vector)', () => {
      const cc = mockCharacterController(0.4, 1, {
        resolveMove: d => ({ appliedTranslation: d, isGrounded: false }),
      });
      const entity = new CharacterController3dEntity({ radius: 0.4, centersDistance: 1 }, null, cc);
      entity.onSpawned({ physicsWorld: { gravity: { x: 0, y: 0, z: 9.82 } } } as any);
      const moveSpy = jest.spyOn(cc, 'move');
      entity.tick$.next([1000, 1000]);
      entity.tick$.next([2000, 1000]); // now airborne - should accelerate along +Z, following the world
      expect(moveSpy.mock.calls[1][0].z).toBeGreaterThan(0);
    });

    it('keeps integrating gravity even while nominally grounded, if gravity flips to pull away from the surface underfoot (regression: got stuck floating in place against the floor instead of falling away from it)', () => {
      // this mock stays reported `isGrounded: true` no matter what - simulating a character resting
      // on a floor whose contact never breaks on its own (matching the real adapters: a sweep would
      // only reports newly-ungrounded once actually moved off the surface)
      const cc = mockCharacterController();
      const entity = new CharacterController3dEntity({ radius: 0.4, centersDistance: 1 }, null, cc);
      entity.onSpawned({ physicsWorld: { gravity: { x: 0, y: 0, z: 9.82 } } } as any);
      const moveSpy = jest.spyOn(cc, 'move');
      entity.tick$.next([1000, 1000]);
      expect(moveSpy.mock.calls[0][0].z).toBeGreaterThan(0); // must start accelerating away immediately, not stay parked at 0
    });

    it('an explicit `gravity` option still overrides physicsWorld.gravity', () => {
      const cc = mockCharacterController(0.4, 1, {
        resolveMove: d => ({ appliedTranslation: d, isGrounded: false }),
      });
      const entity = new CharacterController3dEntity({ radius: 0.4, centersDistance: 1, gravity: 5 }, null, cc);
      entity.onSpawned({ physicsWorld: { gravity: { x: 0, y: 0, z: -999 } } } as any);
      const moveSpy = jest.spyOn(cc, 'move');
      entity.tick$.next([1000, 1000]);
      entity.tick$.next([2000, 1000]);
      expect(moveSpy.mock.calls[1][0].z).toBeCloseTo(-5);
    });

    it('drags the character along a horizontal gravity component too, not just its component along `up` (regression: only the Z component of a tilted gravity vector was ever applied)', () => {
      const cc = mockCharacterController(0.4, 1, {
        resolveMove: d => ({ appliedTranslation: d, isGrounded: false }),
      });
      const entity = new CharacterController3dEntity({ radius: 0.4, centersDistance: 1 }, null, cc);
      entity.onSpawned({ physicsWorld: { gravity: { x: 6, y: 0, z: -20 } } } as any);
      const moveSpy = jest.spyOn(cc, 'move');
      entity.tick$.next([1000, 1000]);
      entity.tick$.next([2000, 1000]); // now airborne - both components of gravity must integrate
      expect(moveSpy.mock.calls[1][0].z).toBeCloseTo(-20);
      expect(moveSpy.mock.calls[1][0].x).toBeCloseTo(6);
    });

    it('slides down (keeps integrating gravity) instead of resting, when grounded against a surface steeper than maxSlopeClimbAngleRad', () => {
      // reports grounded with a near-horizontal ground normal - far steeper than the default
      // ~50deg limit - simulating a character balanced at the silhouette edge of a curved surface
      const cc = mockCharacterController(0.4, 1, {
        resolveMove: d => ({ appliedTranslation: d, isGrounded: true, groundNormal: { x: 1, y: 0, z: 0.05 } }),
      });
      const entity = new CharacterController3dEntity({ radius: 0.4, centersDistance: 1 }, null, cc);
      entity.onSpawned({ physicsWorld: { gravity: { x: 0, y: 0, z: -10 } } } as any);
      const moveSpy = jest.spyOn(cc, 'move');
      entity.tick$.next([1000, 1000]);
      entity.tick$.next([2000, 1000]); // still "isGrounded", but the surface is unwalkably steep
      expect(moveSpy.mock.calls[1][0].z).toBeLessThan(0);
    });

    it('does not slide while grounded on an ordinary walkable surface, even one tilted within maxSlopeClimbAngleRad', () => {
      const cc = mockCharacterController(0.4, 1, {
        resolveMove: d => ({ appliedTranslation: d, isGrounded: true, groundNormal: Pnt3.Z }),
      });
      const entity = new CharacterController3dEntity({ radius: 0.4, centersDistance: 1 }, null, cc);
      entity.onSpawned({ physicsWorld: { gravity: { x: 0, y: 0, z: -10 } } } as any);
      const moveSpy = jest.spyOn(cc, 'move');
      entity.tick$.next([1000, 1000]);
      entity.tick$.next([2000, 1000]);
      expect(moveSpy.mock.calls[1][0].z).toBeCloseTo(0);
    });
  });

  describe('jump', () => {
    it('sets vertical velocity only while grounded', () => {
      const cc = mockCharacterController(0.4, 1, {}, true);
      const entity = new CharacterController3dEntity({ radius: 0.4, centersDistance: 1, jumpSpeed: 5 }, null, cc);
      entity.onSpawned({} as any);
      entity.jump();
      const moveSpy = jest.spyOn(cc, 'move');
      entity.tick$.next([1000, 100]); // 0.1s
      expect(moveSpy.mock.calls[0][0].z).toBeCloseTo(0.5); // 5 m/s * 0.1s
    });

    it('is a no-op mid-air', () => {
      const cc = mockCharacterController(0.4, 1, { resolveMove: d => ({ appliedTranslation: d, isGrounded: false }) });
      const entity = new CharacterController3dEntity(
        { radius: 0.4, centersDistance: 1, jumpSpeed: 5, gravity: 0 },
        null,
        cc,
      );
      entity.onSpawned({} as any);
      entity.tick$.next([1000, 1000]); // becomes airborne
      entity.jump(); // should be ignored: character reports isGrounded === false now
      const moveSpy = jest.spyOn(cc, 'move');
      entity.tick$.next([2000, 100]);
      expect(moveSpy.mock.calls[0][0].z).toBeCloseTo(0);
    });
  });

  describe('object3D sync', () => {
    it('mirrors the resolved position/rotation onto the mesh after move()', () => {
      const cc = mockCharacterController();
      const mesh = mock3DObject();
      const entity = new CharacterController3dEntity({ radius: 0.4, centersDistance: 1, walkSpeed: 4 }, mesh, cc);
      entity.onSpawned({} as any);
      entity.moveDirection = { x: 1, y: 0, z: 0 };
      entity.tick$.next([1000, 1000]);
      expectCloseVector(mesh.position, entity.position);
    });
  });

  describe('hideMesh', () => {
    it('hides the mesh regardless of worldVisible', () => {
      const mesh = mock3DObject();
      const entity = new CharacterController3dEntity({ radius: 0.4, centersDistance: 1 }, mesh, mockCharacterController());
      entity.hideMesh = true;
      expect(mesh.visible).toBe(false);
      entity.hideMesh = false;
      expect(mesh.visible).toBe(true);
    });
  });

  describe('crouch', () => {
    const setupSpawnedEntity = () => {
      const visualScene = { factory: { createCapsule: jest.fn(() => mock3DObject()) }, dispose: () => {} };
      const createdControllers: ReturnType<typeof mockCharacterController>[] = [];
      const physicsWorld = {
        factory: {
          createCharacterController: jest.fn((options: any, transform: any) => {
            const created = mockCharacterController(options.radius, options.centersDistance);
            created.position = transform.position;
            created.rotation = transform.rotation;
            createdControllers.push(created);
            return created;
          }),
        },
        raycast: jest.fn((): any => ({ hasHit: false })),
        dispose: () => {},
      };
      const world = new Gg3dWorld({ visualScene: visualScene as any, physicsWorld: physicsWorld as any });
      const initialCc = mockCharacterController(0.4, 1);
      initialCc.position = { x: 0, y: 0, z: 0.9 }; // feet at z=0 (radius 0.4 + centersDistance/2 0.5)
      const entity = new CharacterController3dEntity(
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
      // feet were at z=0; standing up with crouchCentersDistance=0.5 -> new center at radius+0.25=0.65
      expect(transform.position.z).toBeCloseTo(0.65);
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
});
