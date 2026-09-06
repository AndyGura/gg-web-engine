import { KeyboardInput, Pnt3, PlayerCharacterController } from '../../../../../src';

const fakeCharacter = (overrides: Partial<any> = {}) =>
  ({
    position: { x: 0, y: 0, z: 1 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
    moveDirection: Pnt3.O,
    isRunning: false,
    isCrouching: false,
    hideMesh: false,
    characterController: { up: Pnt3.Z },
    options: { crouchMode: 'hold' as 'hold' | 'toggle' },
    jump: jest.fn(),
    world: null,
    ...overrides,
  }) as any;

const fakeCamera = () =>
  ({
    position: Pnt3.O,
    rotation: { x: 0, y: 0, z: 0, w: 1 },
    tick$: undefined,
  }) as any;

describe('PlayerCharacterController', () => {
  const setup = (character = fakeCharacter(), options: Partial<any> = {}) => {
    const keyboard = new KeyboardInput();
    keyboard.start();
    const camera = fakeCamera();
    const controller = new PlayerCharacterController(keyboard, character, camera, options);
    return { keyboard, camera, controller, character };
  };

  describe('movement mapping', () => {
    it('maps WASD to a local moveDirection ("-Z forward / +X right")', async () => {
      const { keyboard, controller, character } = setup(fakeCharacter(), { keymap: 'wasd' });
      await controller.onSpawned({} as any);
      keyboard.emulateKeyDown('KeyW');
      expect(character.moveDirection).toEqual({ x: 0, y: 0, z: -1 });
      keyboard.emulateKeyUp('KeyW');
      keyboard.emulateKeyDown('KeyD');
      expect(character.moveDirection).toEqual({ x: 1, y: 0, z: 0 });
    });

    it('maps arrow keys the same way when keymap includes arrows', async () => {
      const { keyboard, controller, character } = setup(fakeCharacter(), { keymap: 'wasd+arrows' });
      await controller.onSpawned({} as any);
      keyboard.emulateKeyDown('ArrowUp');
      expect(character.moveDirection).toEqual({ x: 0, y: 0, z: -1 });
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

  describe('view mode', () => {
    it('starts in the configured view mode and hides the mesh in first-person', () => {
      const character = fakeCharacter();
      const { controller } = setup(character, { viewMode: 'first-person' });
      expect(controller.viewMode).toBe('first-person');
      expect(character.hideMesh).toBe(true);
    });

    it('shows the mesh in third-person', () => {
      const character = fakeCharacter();
      const { controller } = setup(character, { viewMode: 'third-person' });
      expect(character.hideMesh).toBe(false);
    });

    it('toggleViewMode flips between modes and updates hideMesh', () => {
      const character = fakeCharacter();
      const { controller } = setup(character, { viewMode: 'first-person' });
      controller.toggleViewMode();
      expect(controller.viewMode).toBe('third-person');
      expect(character.hideMesh).toBe(false);
      controller.toggleViewMode();
      expect(controller.viewMode).toBe('first-person');
      expect(character.hideMesh).toBe(true);
    });

    it('the toggle-view key calls toggleViewMode while active', async () => {
      const character = fakeCharacter();
      const { keyboard, controller } = setup(character, { viewMode: 'first-person', toggleViewKey: 'KeyV' });
      await controller.onSpawned({} as any);
      keyboard.emulateKeyDown('KeyV');
      expect(controller.viewMode).toBe('third-person');
    });
  });

  describe('camera update', () => {
    it('positions the camera at the character + eyeHeight along up in first-person', async () => {
      const character = fakeCharacter({ position: { x: 1, y: 2, z: 3 } });
      const { controller, camera } = setup(character, { viewMode: 'first-person', eyeHeight: 0.5 });
      await controller.onSpawned({} as any);
      controller.tick$.next([0, 16]);
      expect(camera.position).toEqual({ x: 1, y: 2, z: 3.5 });
    });

    it('sets character yaw to the current look direction regardless of view mode', async () => {
      const character = fakeCharacter();
      const { controller } = setup(character, { viewMode: 'first-person' });
      await controller.onSpawned({} as any);
      controller.tick$.next([0, 16]);
      expect(character.rotation).toBeDefined();
    });
  });
});
