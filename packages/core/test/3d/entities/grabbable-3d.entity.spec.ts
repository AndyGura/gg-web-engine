import { Grabbable3dEntity, Pnt3 } from '../../../src';
import { mock3DBody } from '../../mocks/body.mock';
import { mock3DObject } from '../../mocks/object.mock';

describe('Grabbable3dEntity', () => {
  const setup = (grabOptions: Partial<any> = {}) => {
    const objectBody = mock3DBody();
    const object3D = mock3DObject();
    const entity = new Grabbable3dEntity({ object3D, objectBody }, grabOptions);
    (entity as any)._world = { physicsWorld: { gravity: { x: 0, y: 0, z: -9.82 } } };
    return { entity, objectBody, object3D };
  };

  describe('constructor', () => {
    it('throws if constructed without a rigid body', () => {
      expect(() => new Grabbable3dEntity({ object3D: mock3DObject() })).toThrow();
    });
  });

  describe('grab/release/throw', () => {
    it('starts not held', () => {
      const { entity } = setup();
      expect(entity.isHeld).toBe(false);
    });

    it('grab() marks it held and zeroes existing velocity', () => {
      const { entity, objectBody } = setup();
      objectBody.linearVelocity = { x: 5, y: 0, z: 0 };
      objectBody.angularVelocity = { x: 1, y: 0, z: 0 };
      entity.grab();
      expect(entity.isHeld).toBe(true);
      expect(objectBody.linearVelocity).toEqual(Pnt3.O);
      expect(objectBody.angularVelocity).toEqual(Pnt3.O);
    });

    it('grab() is a no-op if already held', () => {
      const { entity, objectBody } = setup();
      entity.grab();
      objectBody.linearVelocity = { x: 5, y: 0, z: 0 };
      entity.grab(); // should not reset velocity again
      expect(objectBody.linearVelocity).toEqual({ x: 5, y: 0, z: 0 });
    });

    it('grab() excludes the given collision groups, release() restores them', () => {
      const { entity, objectBody } = setup();
      objectBody.interactWithCollisionGroups = [0, 1, 2];
      entity.grab([1]);
      expect(objectBody.interactWithCollisionGroups).toEqual([0, 2]);
      entity.release();
      expect(objectBody.interactWithCollisionGroups).toEqual([0, 1, 2]);
      expect(entity.isHeld).toBe(false);
    });

    it('release() is a no-op if not held', () => {
      const { entity, objectBody } = setup();
      objectBody.interactWithCollisionGroups = [0, 1, 2];
      entity.release();
      expect(objectBody.interactWithCollisionGroups).toEqual([0, 1, 2]);
    });

    it('throw() releases and imparts the given velocity', () => {
      const { entity, objectBody } = setup();
      objectBody.interactWithCollisionGroups = [0, 1];
      entity.grab([1]);
      entity.throw({ x: 0, y: 10, z: 0 });
      expect(entity.isHeld).toBe(false);
      expect(objectBody.linearVelocity).toEqual({ x: 0, y: 10, z: 0 });
      expect(objectBody.interactWithCollisionGroups).toEqual([0, 1]);
    });
  });

  describe('updateHold', () => {
    it('is a no-op while not held', () => {
      const { entity, objectBody } = setup();
      entity.updateHold({ x: 10, y: 0, z: 0 }, 1 / 60);
      expect(objectBody.linearVelocity).toEqual(Pnt3.O);
    });

    it('drives velocity towards the target, compensating for one frame of gravity', () => {
      const { entity, objectBody } = setup({ followStrength: 1, maxFollowSpeed: 1000, maxHoldDistance: 1000 });
      entity.grab();
      const dt = 1 / 60;
      entity.updateHold({ x: 10, y: 0, z: 0 }, dt);
      // toTarget = (10,0,0), followStrength=1 -> desired (10,0,0); minus gravity*dt along Z
      expect(objectBody.linearVelocity.x).toBeCloseTo(10);
      expect(objectBody.linearVelocity.y).toBeCloseTo(0);
      expect(objectBody.linearVelocity.z).toBeCloseTo(9.82 * dt);
    });

    it('clamps the follow velocity to maxFollowSpeed', () => {
      const { entity, objectBody } = setup({ followStrength: 100, maxFollowSpeed: 5, maxHoldDistance: 1000 });
      entity.grab();
      entity.updateHold({ x: 10, y: 0, z: 0 }, 0);
      expect(Pnt3.len(objectBody.linearVelocity)).toBeCloseTo(5);
    });

    it('force-releases when the target is farther than maxHoldDistance', () => {
      const { entity, objectBody } = setup({ maxHoldDistance: 2 });
      entity.grab();
      entity.updateHold({ x: 10, y: 0, z: 0 }, 1 / 60);
      expect(entity.isHeld).toBe(false);
    });

    it('damps angular velocity towards zero per angularDamping', () => {
      const { entity, objectBody } = setup({ angularDamping: 0.5 });
      entity.grab();
      objectBody.angularVelocity = { x: 2, y: 0, z: 0 };
      entity.updateHold(objectBody.position, 1 / 60);
      expect(objectBody.angularVelocity).toEqual({ x: 1, y: 0, z: 0 });
    });

    it('leaves angular velocity alone when angularDamping is 0', () => {
      const { entity, objectBody } = setup({ angularDamping: 0 });
      entity.grab();
      objectBody.angularVelocity = { x: 2, y: 0, z: 0 };
      entity.updateHold(objectBody.position, 1 / 60);
      expect(objectBody.angularVelocity).toEqual({ x: 2, y: 0, z: 0 });
    });
  });

  describe('onRemoved', () => {
    it('releases the object if it was still held', () => {
      const { entity, objectBody } = setup();
      objectBody.interactWithCollisionGroups = [0, 1];
      entity.grab([1]);
      (entity as any)._world = { removeEntity() {} };
      entity.onRemoved();
      expect(entity.isHeld).toBe(false);
      expect(objectBody.interactWithCollisionGroups).toEqual([0, 1]);
    });
  });
});
