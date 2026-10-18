import { Subject } from 'rxjs';
import {
  DEFAULT_FREE_CAMERA_GAMEPAD_BINDING,
  FreeCameraController,
  GamepadInput,
  KeyboardInput,
  Pnt3,
  Qtrn,
} from '../../../../../src';
import { stubGamepads } from '../../../../mocks/gamepad.mock';

const fakeCamera = () =>
  ({
    position: { x: 0, y: 0, z: 0 },
    rotation: Qtrn.lookAt(Pnt3.O, Pnt3.X),
    tick$: new Subject<[number, number]>(),
    camera: { fov: 75, supportsFov: false },
  }) as any;

describe('FreeCameraController', () => {
  describe('gamepad', () => {
    let pads: ReturnType<typeof stubGamepads>;
    let gamepadInput: GamepadInput;
    beforeEach(() => {
      pads = stubGamepads();
      gamepadInput = new GamepadInput();
      gamepadInput.start();
    });
    afterEach(() => {
      gamepadInput.stop();
      pads.restore();
    });

    const setup = async (options: Partial<any> = {}) => {
      const keyboard = new KeyboardInput();
      keyboard.start();
      const camera = fakeCamera();
      const controller = new FreeCameraController(keyboard, camera, { keymap: 'wasd', ...options });
      await controller.onSpawned({ gamepadInput } as any);
      return { keyboard, camera, controller };
    };

    const forward = (camera: any) => Pnt3.rot({ x: 0, y: 0, z: -1 }, camera.rotation);

    it('flies by the keys given to setKeys, the gamepad buttons pressing the new keys', async () => {
      const { keyboard, camera, controller } = await setup({ cameraLinearSpeed: 10 });
      const changes: void[] = [];
      controller.keysChanged$.subscribe(v => changes.push(v));
      controller.setKeys({ upDownKeys: ['Space', 'KeyC'], boostKey: 'KeyB' });
      expect(controller.options.upDownKeys).toEqual(['Space', 'KeyC']);
      expect(controller.options.boostKey).toBe('KeyB');
      expect(changes.length).toBe(1);

      keyboard.emulateKeyDown('KeyE');
      camera.tick$.next([0, 1000]);
      expect(Pnt3.len(camera.position)).toBe(0);
      keyboard.emulateKeyUp('KeyE');

      keyboard.emulateKeyDown('Space');
      keyboard.emulateKeyDown('KeyB');
      camera.tick$.next([0, 1000]);
      expect(Pnt3.len(camera.position)).toBeCloseTo(25, 5);
      keyboard.emulateKeyUp('Space');
      keyboard.emulateKeyUp('KeyB');

      const pressed: boolean[] = [];
      keyboard.bind('KeyC').subscribe(v => pressed.push(v));
      pads.set({ buttons: { 4: true } }); // the down button
      gamepadInput.poll();
      expect(pressed).toEqual([false, true]);
      controller.onRemoved();
    });

    it('flies by the left stick and the up/down buttons, boosted by the boost button', async () => {
      const plain = await setup({ cameraLinearSpeed: 10 });
      const boosted = await setup({ cameraLinearSpeed: 10 });
      pads.set({ axes: [0, -1], buttons: { 5: true } }); // forward and up at once: normalized
      gamepadInput.poll();
      plain.camera.tick$.next([0, 1000]);
      pads.set({ axes: [0, -1], buttons: { 5: true, 10: true } });
      gamepadInput.poll();
      boosted.camera.tick$.next([0, 1000]);
      expect(Pnt3.len(plain.camera.position)).toBeCloseTo(10, 5);
      expect(Pnt3.len(boosted.camera.position)).toBeCloseTo(25, 5);
      plain.controller.onRemoved();
      boosted.controller.onRemoved();
    });

    it('flies by the gamepad with ignoreKeyboardUnlessPointerLocked and no pointer lock', async () => {
      const { camera, controller } = await setup({ cameraLinearSpeed: 10, ignoreKeyboardUnlessPointerLocked: true });
      pads.set({ axes: [0, -1], buttons: { 5: true } });
      gamepadInput.poll();
      camera.tick$.next([0, 1000]);
      expect(Pnt3.len(camera.position)).toBeCloseTo(10, 5);
      controller.onRemoved();
    });

    it('keeps flying by a held stick after a key is tapped, with ignoreKeyboardUnlessPointerLocked', async () => {
      const { camera, controller } = await setup({ cameraLinearSpeed: 10, ignoreKeyboardUnlessPointerLocked: true });
      pads.set({ axes: [0, -1] });
      gamepadInput.poll();
      // a tap on any key hands "in use" over to the keyboard, while the stick is still held forward
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape' }));
      expect(gamepadInput.inUse).toBe(false);
      gamepadInput.poll();
      camera.tick$.next([0, 1000]);
      expect(Pnt3.len(camera.position)).toBeCloseTo(10, 5);
      controller.onRemoved();
    });

    it('looks by the right stick at lookSpeed', async () => {
      const { camera, controller } = await setup();
      camera.tick$.next([0, 16]);
      const before = forward(camera);
      pads.set({ axes: [0, 0, 1, 0] });
      gamepadInput.poll();
      camera.tick$.next([16, 1000]);
      const after = forward(camera);
      const yawBefore = Math.atan2(before.y, before.x);
      const yawAfter = Math.atan2(after.y, after.x);
      expect(Math.abs(yawAfter - yawBefore)).toBeCloseTo(DEFAULT_FREE_CAMERA_GAMEPAD_BINDING.lookSpeed, 5);
      expect(after.z).toBeCloseTo(before.z, 5);
      controller.onRemoved();
    });

    it('does nothing with gamepad: null', async () => {
      const { camera, controller } = await setup({ gamepad: null });
      pads.set({ axes: [0, -1, 1, 0], buttons: { 5: true } });
      gamepadInput.poll();
      camera.tick$.next([0, 1000]);
      expect(camera.position).toEqual({ x: 0, y: 0, z: 0 });
      controller.onRemoved();
    });
  });
});
