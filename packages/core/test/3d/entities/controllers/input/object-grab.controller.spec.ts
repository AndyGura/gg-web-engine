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

const fakeCamera = (position: any = Pnt3.O, rotation: any = { x: 0, y: 0, z: 0, w: 1 }) =>
  ({ position, rotation }) as any; // identity rotation: forward = -Z

const fakeHolder = (position: any = Pnt3.O, radius = 0.3, centersDistance = 1.0) =>
  ({
    position,
    characterController: { up: Pnt3.Z, radius, centersDistance, ignoredBodies: new Set() },
  }) as any;

const makeGrabbable = (grabOptions: Partial<any> = {}) => {
  const objectBody = mock3DBody();
  const entity = new Grabbable3dEntity({ object3D: mock3DObject(), objectBody }, grabOptions);
  return { entity, objectBody };
};

describe('ObjectGrabController', () => {
  // Far below the origin by default so the holder-exclusion clamp (see its own dedicated tests
  // below) never engages for tests that aren't exercising it.
  const setup = (options: Partial<any> = {}, holder: any = fakeHolder({ x: 0, y: 0, z: -1000 })) => {
    const keyboard = new KeyboardInput();
    keyboard.start();
    const mouseInput = new MouseInput();
    mouseInput.start();
    const camera = fakeCamera();
    const controller = new ObjectGrabController(keyboard, mouseInput, camera, holder, options);
    return { keyboard, mouseInput, camera, holder, controller };
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
  });

  describe(
    "holder.characterController.ignoredBodies (regression: the holder's own movement treating a " +
      'held prop as a solid obstacle - collision groups alone cannot express "exclude just this ' +
      'pair" when both share a group needed for ordinary world collision, see the class doc)',
    () => {
      it("grabbing adds the held object's body to the holder's ignoredBodies", () => {
        const raycast = jest.fn();
        const { entity, objectBody } = makeGrabbable();
        raycast.mockReturnValue({ hasHit: true, hitBody: { entity } });
        const { keyboard, holder, controller } = setup();
        controller.onSpawned({ physicsWorld: { raycast } } as any);

        keyboard.emulateKeyDown('KeyE');

        expect(holder.characterController.ignoredBodies.has(objectBody)).toBe(true);
      });

      it('dropping (right mouse button) removes it again', () => {
        const raycast = jest.fn();
        const { entity, objectBody } = makeGrabbable();
        raycast.mockReturnValue({ hasHit: true, hitBody: { entity } });
        const { keyboard, mouseInput, holder, controller } = setup();
        controller.onSpawned({ physicsWorld: { raycast } } as any);
        keyboard.emulateKeyDown('KeyE');

        emitMouseState(mouseInput, MouseInputState.DRAG_RIGHT_BUTTON);

        expect(holder.characterController.ignoredBodies.has(objectBody)).toBe(false);
      });

      it('throwing removes it again', () => {
        const raycast = jest.fn();
        const { entity, objectBody } = makeGrabbable();
        raycast.mockReturnValue({ hasHit: true, hitBody: { entity } });
        const { keyboard, mouseInput, holder, controller } = setup();
        controller.onSpawned({ physicsWorld: { raycast } } as any);
        keyboard.emulateKeyDown('KeyE');

        emitMouseState(mouseInput, MouseInputState.DRAG);

        expect(holder.characterController.ignoredBodies.has(objectBody)).toBe(false);
      });

      it("updateHold's own self-release (regression: a stale ignoredBodies entry left behind by the " + 'same edge case that used to leave a stale heldObject reference) removes it too', () => {
        const raycast = jest.fn();
        const { entity, objectBody } = makeGrabbable({ maxHoldDistance: 0.001 });
        raycast.mockReturnValue({ hasHit: true, hitBody: { entity } });
        const { keyboard, holder, controller } = setup({ holdDistance: 2 });
        controller.onSpawned({ physicsWorld: { raycast } } as any);
        keyboard.emulateKeyDown('KeyE');
        expect(holder.characterController.ignoredBodies.has(objectBody)).toBe(true);

        controller.tick$.next([0, 16]); // hold point (0,0,-2) vs object at origin -> force-release

        expect(holder.characterController.ignoredBodies.has(objectBody)).toBe(false);
      });

      it('is a no-op (no throw) when there is no holder', () => {
        const raycast = jest.fn();
        const { entity } = makeGrabbable();
        raycast.mockReturnValue({ hasHit: true, hitBody: { entity } });
        const { keyboard, controller } = setup({}, null);
        controller.onSpawned({ physicsWorld: { raycast } } as any);

        expect(() => keyboard.emulateKeyDown('KeyE')).not.toThrow(); // grabs
        keyboard.emulateKeyUp('KeyE');
        expect(() => keyboard.emulateKeyDown('KeyE')).not.toThrow(); // drops it again
      });
    },
  );

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

  describe('holder-exclusion clamp (regression: looking down to wedge a held prop under your own ' +
    'feet used to drive it straight into the holder\'s capsule every tick)', () => {
    it('pushes the hold point radially off the holder\'s own axis when it would otherwise land inside the capsule', () => {
      const raycast = jest.fn();
      const { entity, objectBody } = makeGrabbable();
      raycast.mockReturnValue({ hasHit: true, hitBody: { entity } });
      // Holder capsule at the origin (radius 0.3, centersDistance 1.0); camera 1.6m above it,
      // looking straight down (identity rotation -> forward -Z) - exactly "looking down to put it
      // under your own feet". Raw hold point (0,0,0.1) would land on the capsule's own central
      // axis, comfortably inside it.
      const camera = fakeCamera({ x: 0, y: 0, z: 1.6 });
      const holder = fakeHolder(Pnt3.O, 0.3, 1.0);
      const keyboard = new KeyboardInput();
      keyboard.start();
      const mouseInput = new MouseInput();
      mouseInput.start();
      const controller = new ObjectGrabController(keyboard, mouseInput, camera, holder);
      controller.onSpawned({ physicsWorld: { raycast } } as any);
      keyboard.emulateKeyDown('KeyE');

      controller.tick$.next([0, 16]);

      // Landing exactly on the axis has no well-defined outward direction, so this falls back to
      // the camera's horizontal right (its forward is purely vertical here) - pushed towards +X,
      // not left driving straight down into the holder (which would show up as z only, x === 0).
      expect(objectBody.linearVelocity.x).toBeGreaterThan(0);
    });

    it('leaves the hold point alone once it is already outside the holder\'s exclusion cylinder', () => {
      const raycast = jest.fn();
      const { entity, objectBody } = makeGrabbable();
      raycast.mockReturnValue({ hasHit: true, hitBody: { entity } });
      // Same holder, but the camera (and so the hold point) is well clear of its exclusion cylinder
      // (keepOutRadius 0.6m) off to the side.
      const camera = fakeCamera({ x: 3, y: 0, z: 1.6 });
      const holder = fakeHolder(Pnt3.O, 0.3, 1.0);
      const keyboard = new KeyboardInput();
      keyboard.start();
      const mouseInput = new MouseInput();
      mouseInput.start();
      const controller = new ObjectGrabController(keyboard, mouseInput, camera, holder, { holdDistance: 1.5 });
      controller.onSpawned({ physicsWorld: { raycast } } as any);
      keyboard.emulateKeyDown('KeyE');

      controller.tick$.next([0, 16]);

      // Unclamped hold point is (3,0,0.1) - object starts at the origin, so the spring pulls it
      // towards +X exactly as if no clamp existed at all.
      expect(objectBody.linearVelocity.x).toBeGreaterThan(0);
      expect(objectBody.linearVelocity.z).toBeGreaterThan(0);
    });

    it('is skipped entirely when there is no holder (e.g. paired with a FreeCameraController)', () => {
      const raycast = jest.fn();
      const { entity, objectBody } = makeGrabbable();
      raycast.mockReturnValue({ hasHit: true, hitBody: { entity } });
      const { keyboard, controller } = setup({}, null);
      controller.onSpawned({ physicsWorld: { raycast } } as any);
      keyboard.emulateKeyDown('KeyE');

      expect(() => controller.tick$.next([0, 16])).not.toThrow();
      // setup()'s camera sits at the origin looking straight down (identity rotation, forward -Z);
      // holdDistance defaults to 1.5 -> target (0,0,-1.5), reaching the object unclamped since
      // holder is null.
      expect(objectBody.linearVelocity.z).toBeLessThan(0);
    });
  });
});
