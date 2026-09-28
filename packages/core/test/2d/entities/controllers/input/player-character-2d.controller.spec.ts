import { KeyboardInput, Pnt2, PlayerCharacterController2d } from '../../../../../src';

const fakeCharacter = (overrides: Partial<any> = {}) =>
  ({
    position: { x: 0, y: 0 },
    moveDirection: 0,
    isRunning: false,
    isCrouching: false,
    facing: 1,
    characterController: { up: Pnt2.nY },
    options: { crouchMode: 'hold' as 'hold' | 'toggle' },
    jump: jest.fn(),
    ...overrides,
  }) as any;

const fakeCamera = () =>
  ({
    position: Pnt2.O,
  }) as any;

describe('PlayerCharacterController2d', () => {
  const setup = (character = fakeCharacter(), options: Partial<any> = {}) => {
    const keyboard = new KeyboardInput();
    keyboard.start();
    const camera = fakeCamera();
    const controller = new PlayerCharacterController2d(keyboard, character, camera, options);
    return { keyboard, camera, controller, character };
  };

  describe('movement mapping', () => {
    it('maps the left key to a negative moveDirection (left is against `right`)', async () => {
      const { keyboard, controller, character } = setup(fakeCharacter(), { keymap: 'wasd' });
      await controller.onSpawned({} as any);
      keyboard.emulateKeyDown('KeyA');
      expect(character.moveDirection).toBe(-1);
      keyboard.emulateKeyUp('KeyA');
      expect(character.moveDirection).toBe(0);
    });

    it('maps the right key to a positive moveDirection', async () => {
      const { keyboard, controller, character } = setup(fakeCharacter(), { keymap: 'wasd' });
      await controller.onSpawned({} as any);
      keyboard.emulateKeyDown('KeyD');
      expect(character.moveDirection).toBe(1);
    });

    it('maps arrow keys the same way when keymap includes arrows', async () => {
      const { keyboard, controller, character } = setup(fakeCharacter(), { keymap: 'wasd+arrows' });
      await controller.onSpawned({} as any);
      keyboard.emulateKeyDown('ArrowLeft');
      expect(character.moveDirection).toBe(-1);
      keyboard.emulateKeyUp('ArrowLeft');
      keyboard.emulateKeyDown('ArrowRight');
      expect(character.moveDirection).toBe(1);
    });
  });

  describe('jump/run/crouch keys', () => {
    it('calls character.jump() on the jump key while active', async () => {
      const { keyboard, controller, character } = setup();
      await controller.onSpawned({} as any);
      keyboard.emulateKeyDown('Space');
      expect(character.jump).toHaveBeenCalledTimes(1);
      keyboard.emulateKeyUp('Space');
      expect(character.jump).toHaveBeenCalledTimes(1); // no call on key-up
    });

    it('does not react to the jump key while inactive', async () => {
      const { keyboard, controller, character } = setup();
      await controller.onSpawned({} as any);
      controller.active = false;
      keyboard.emulateKeyDown('Space');
      expect(character.jump).not.toHaveBeenCalled();
    });

    it('sets isRunning while the run key is held', async () => {
      const { keyboard, controller, character } = setup();
      await controller.onSpawned({} as any);
      keyboard.emulateKeyDown('ShiftLeft');
      expect(character.isRunning).toBe(true);
      keyboard.emulateKeyUp('ShiftLeft');
      expect(character.isRunning).toBe(false);
    });

    it('holds crouch while the crouch key is held in "hold" mode', async () => {
      const character = fakeCharacter({ options: { crouchMode: 'hold' } });
      const { keyboard, controller } = setup(character);
      await controller.onSpawned({} as any);
      keyboard.emulateKeyDown('ControlLeft');
      expect(character.isCrouching).toBe(true);
      keyboard.emulateKeyUp('ControlLeft');
      expect(character.isCrouching).toBe(false);
    });

    it('toggles crouch on each key-down in "toggle" mode', async () => {
      const character = fakeCharacter({ options: { crouchMode: 'toggle' } });
      const { keyboard, controller } = setup(character);
      await controller.onSpawned({} as any);
      keyboard.emulateKeyDown('ControlLeft');
      expect(character.isCrouching).toBe(true);
      keyboard.emulateKeyUp('ControlLeft'); // no change on release
      expect(character.isCrouching).toBe(true);
      keyboard.emulateKeyDown('ControlLeft');
      expect(character.isCrouching).toBe(false);
    });
  });

  describe('camera follow', () => {
    it('moves the camera towards the character position, smoothed rather than snapped', async () => {
      const character = fakeCharacter({ position: { x: 100, y: 0 } });
      const { controller, camera } = setup(character, { cameraSmoothing: 0.1 });
      await controller.onSpawned({} as any);
      controller.tick$.next([0, 16]);
      expect(camera.position.x).toBeGreaterThan(0);
      expect(camera.position.x).toBeLessThan(100);
    });

    it('snaps the camera fully onto the character with cameraSmoothing <= 0', async () => {
      const character = fakeCharacter({ position: { x: 100, y: 5 } });
      const { controller, camera } = setup(character, { cameraSmoothing: 0 });
      await controller.onSpawned({} as any);
      controller.tick$.next([0, 16]);
      expect(camera.position).toEqual({ x: 100, y: 5 });
    });

    it('offsets the look-ahead target along `right` by `facing`, not always in the same direction', async () => {
      const character = fakeCharacter({ position: { x: 0, y: 0 }, facing: -1 });
      const { controller, camera } = setup(character, { cameraSmoothing: 0, lookAheadDistance: 50 });
      await controller.onSpawned({} as any);
      controller.tick$.next([0, 16]);
      // up is {x:0,y:-1}, so right is {x:1,y:0} - facing -1 should look ahead in -x
      expect(camera.position.x).toBeCloseTo(-50);
    });

    it('is a no-op when there is no character', async () => {
      const { controller, camera } = setup(null as any);
      await controller.onSpawned({} as any);
      expect(() => controller.tick$.next([0, 16])).not.toThrow();
      expect(camera.position).toEqual(Pnt2.O);
    });
  });
});
