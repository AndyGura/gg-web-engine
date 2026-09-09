import {
  Grabbable3dEntity,
  KeyboardInput,
  MouseInput,
  MouseInputState,
  ObjectGrabController,
  Pnt3,
} from '../../../../../src';
import { mock3DBody } from '../../../../mocks/body.mock';
import { mock3DObject } from '../../../../mocks/object.mock';

const fakeCamera = () =>
  ({
    position: Pnt3.O,
    rotation: { x: 0, y: 0, z: 0, w: 1 }, // identity: forward = -Z
  }) as any;

const makeGrabbable = (grabOptions: Partial<any> = {}) => {
  const objectBody = mock3DBody();
  objectBody.interactWithCollisionGroups = [0, 1];
  const entity = new Grabbable3dEntity({ object3D: mock3DObject(), objectBody }, grabOptions);
  return { entity, objectBody };
};

describe('ObjectGrabController', () => {
  const setup = (options: Partial<any> = {}) => {
    const keyboard = new KeyboardInput();
    keyboard.start();
    const mouseInput = new MouseInput();
    mouseInput.start();
    const camera = fakeCamera();
    const controller = new ObjectGrabController(keyboard, mouseInput, camera, options);
    return { keyboard, mouseInput, camera, controller };
  };

  const emitMouseState = (mouseInput: MouseInput, state: MouseInputState) => (mouseInput as any)._state$.next(state);

  describe('grabbing', () => {
    it('grabs a Grabbable3dEntity hit by the forward raycast on the grab key', () => {
      const raycast = jest.fn();
      const { entity } = makeGrabbable();
      raycast.mockReturnValue({ hasHit: true, hitBody: { entity } });
      const { keyboard, controller } = setup();
      controller.onSpawned({ physicsWorld: { raycast } } as any);

      keyboard.emulateKeyDown('KeyE');

      expect(controller.heldObject).toBe(entity);
      expect(entity.isHeld).toBe(true);
      const { from, to } = raycast.mock.calls[0][0];
      expect(from).toEqual(Pnt3.O);
      // identity rotation -> forward is -Z, maxGrabDistance defaults to 3
      expect(to.z).toBeCloseTo(-3);
    });

    it('does nothing if the raycast misses', () => {
      const raycast = jest.fn().mockReturnValue({ hasHit: false });
      const { keyboard, controller } = setup();
      controller.onSpawned({ physicsWorld: { raycast } } as any);
      keyboard.emulateKeyDown('KeyE');
      expect(controller.heldObject).toBeNull();
    });

    it('does nothing if the hit body belongs to a plain entity (not a Grabbable3dEntity)', () => {
      const raycast = jest.fn().mockReturnValue({ hasHit: true, hitBody: { entity: {} } });
      const { keyboard, controller } = setup();
      controller.onSpawned({ physicsWorld: { raycast } } as any);
      keyboard.emulateKeyDown('KeyE');
      expect(controller.heldObject).toBeNull();
    });

    it('pressing the grab key again while holding something drops it instead of grabbing a new one', () => {
      const raycast = jest.fn();
      const { entity: first } = makeGrabbable();
      const { entity: second } = makeGrabbable();
      raycast.mockReturnValueOnce({ hasHit: true, hitBody: { entity: first } });
      raycast.mockReturnValueOnce({ hasHit: true, hitBody: { entity: second } });
      const { keyboard, controller } = setup();
      controller.onSpawned({ physicsWorld: { raycast } } as any);

      keyboard.emulateKeyDown('KeyE');
      keyboard.emulateKeyUp('KeyE');
      keyboard.emulateKeyDown('KeyE');

      expect(controller.heldObject).toBeNull();
      expect(first.isHeld).toBe(false);
      expect(second.isHeld).toBe(false); // never grabbed - the second press dropped, it didn't re-raycast
      expect(raycast).toHaveBeenCalledTimes(1);
    });

    it('passes holderCollisionGroups through to grab()', () => {
      const raycast = jest.fn();
      const { entity, objectBody } = makeGrabbable();
      raycast.mockReturnValue({ hasHit: true, hitBody: { entity } });
      const { keyboard, controller } = setup({ holderCollisionGroups: [1] });
      controller.onSpawned({ physicsWorld: { raycast } } as any);

      keyboard.emulateKeyDown('KeyE');

      expect(objectBody.interactWithCollisionGroups).toEqual([0]);
    });
  });

  describe('throw/drop', () => {
    it('left mouse button throws the held object forward and clears heldObject', () => {
      const raycast = jest.fn();
      const { entity, objectBody } = makeGrabbable();
      raycast.mockReturnValue({ hasHit: true, hitBody: { entity } });
      const { keyboard, mouseInput, controller } = setup({ throwSpeed: 10 });
      controller.onSpawned({ physicsWorld: { raycast } } as any);
      keyboard.emulateKeyDown('KeyE');

      emitMouseState(mouseInput, MouseInputState.DRAG);

      expect(controller.heldObject).toBeNull();
      expect(entity.isHeld).toBe(false);
      expect(objectBody.linearVelocity.z).toBeCloseTo(-10); // identity rotation -> forward -Z
    });

    it('right mouse button drops the held object in place and clears heldObject', () => {
      const raycast = jest.fn();
      const { entity, objectBody } = makeGrabbable();
      raycast.mockReturnValue({ hasHit: true, hitBody: { entity } });
      const { keyboard, mouseInput, controller } = setup();
      controller.onSpawned({ physicsWorld: { raycast } } as any);
      keyboard.emulateKeyDown('KeyE');
      objectBody.linearVelocity = { x: 1, y: 2, z: 3 };

      emitMouseState(mouseInput, MouseInputState.DRAG_RIGHT_BUTTON);

      expect(controller.heldObject).toBeNull();
      expect(entity.isHeld).toBe(false);
      expect(objectBody.linearVelocity).toEqual({ x: 1, y: 2, z: 3 }); // untouched by a drop
    });

    it('mouse buttons are no-ops while empty-handed', () => {
      const { mouseInput, controller } = setup();
      controller.onSpawned({ physicsWorld: { raycast: jest.fn() } } as any);
      expect(() => emitMouseState(mouseInput, MouseInputState.DRAG)).not.toThrow();
      expect(() => emitMouseState(mouseInput, MouseInputState.DRAG_RIGHT_BUTTON)).not.toThrow();
      expect(controller.heldObject).toBeNull();
    });

    it('onRemoved drops whatever is currently held', () => {
      const raycast = jest.fn();
      const { entity } = makeGrabbable();
      raycast.mockReturnValue({ hasHit: true, hitBody: { entity } });
      const { keyboard, controller } = setup();
      controller.onSpawned({ physicsWorld: { raycast }, removeEntity() {} } as any);
      keyboard.emulateKeyDown('KeyE');

      controller.onRemoved();

      expect(entity.isHeld).toBe(false);
    });
  });

  describe('per-tick hold updates', () => {
    it('drives the held object towards a point in front of the camera each tick', () => {
      const raycast = jest.fn();
      const { entity, objectBody } = makeGrabbable();
      raycast.mockReturnValue({ hasHit: true, hitBody: { entity } });
      const { keyboard, controller, camera } = setup({ holdDistance: 2 });
      controller.onSpawned({ physicsWorld: { raycast } } as any);
      keyboard.emulateKeyDown('KeyE');

      controller.tick$.next([0, 16]);

      // identity camera rotation, forward -Z, holdDistance 2 -> target (0,0,-2); object starts at
      // origin, so the spring should be pulling it towards -Z.
      expect(objectBody.linearVelocity.z).toBeLessThan(0);
      void camera;
    });

    it('does nothing per-tick while empty-handed', () => {
      const { controller } = setup();
      controller.onSpawned({ physicsWorld: { raycast: jest.fn() } } as any);
      expect(() => controller.tick$.next([0, 16])).not.toThrow();
    });

    it(
      'stays in sync when the held object force-releases itself mid-hold (regression: a stale ' +
        'heldObject reference used to block every subsequent grab attempt)',
      () => {
        const raycast = jest.fn();
        // a tiny maxHoldDistance so a single tick's hold-point jump forces a self-release
        const { entity } = makeGrabbable({ maxHoldDistance: 0.001 });
        raycast.mockReturnValue({ hasHit: true, hitBody: { entity } });
        const { keyboard, controller } = setup({ holdDistance: 2 });
        controller.onSpawned({ physicsWorld: { raycast } } as any);
        keyboard.emulateKeyDown('KeyE');
        expect(controller.heldObject).toBe(entity);

        controller.tick$.next([0, 16]); // hold point (0,0,-2) vs object at origin -> force-release

        expect(entity.isHeld).toBe(false);
        expect(controller.heldObject).toBeNull();

        // a fresh grab attempt must not be blocked by a stale reference to the released object
        const { entity: second } = makeGrabbable();
        raycast.mockReturnValue({ hasHit: true, hitBody: { entity: second } });
        keyboard.emulateKeyUp('KeyE');
        keyboard.emulateKeyDown('KeyE');
        expect(controller.heldObject).toBe(second);
      },
    );
  });
});
