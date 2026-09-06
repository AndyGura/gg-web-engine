import { KeyboardInput, Pnt3, PlayerCharacterController, Qtrn } from '../../../../../src';

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
    it('maps WASD to a local moveDirection ("+Y forward / +X right", matching the vehicle axis paradigm)', async () => {
      const { keyboard, controller, character } = setup(fakeCharacter(), { keymap: 'wasd' });
      await controller.onSpawned({} as any);
      keyboard.emulateKeyDown('KeyW');
      expect(character.moveDirection).toEqual({ x: 0, y: 1, z: 0 });
      keyboard.emulateKeyUp('KeyW');
      keyboard.emulateKeyDown('KeyD');
      expect(character.moveDirection).toEqual({ x: 1, y: 0, z: 0 });
    });

    it('maps arrow keys the same way when keymap includes arrows', async () => {
      const { keyboard, controller, character } = setup(fakeCharacter(), { keymap: 'wasd+arrows' });
      await controller.onSpawned({} as any);
      keyboard.emulateKeyDown('ArrowUp');
      expect(character.moveDirection).toEqual({ x: 0, y: 1, z: 0 });
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

    it('keeps the capsule upright: character.rotation must be a pure rotation around `up`', async () => {
      // Regression test: character.rotation must never tip the capsule over (a `Qtrn.lookAt`-style
      // camera basis would, since the capsule's rest orientation has its long axis along `up`, not
      // along a camera's local Y - see `CharacterController3dEntity`'s own doc). Rotating `up`
      // itself by the character's rotation must always yield `up` unchanged, for any yaw.
      const character = fakeCharacter();
      const { controller } = setup(character, { viewMode: 'third-person' });
      await controller.onSpawned({} as any);
      controller.tick$.next([0, 16]);
      const up = character.characterController.up;
      const rotatedUp = Pnt3.rot(up, character.rotation);
      expect(rotatedUp.x).toBeCloseTo(up.x);
      expect(rotatedUp.y).toBeCloseTo(up.y);
      expect(rotatedUp.z).toBeCloseTo(up.z);
    });

    it('rotates the character so local forward (+Y) matches the camera look direction', async () => {
      // Regression test for the theta -> yaw conversion's -90° offset (see
      // `updateCamera`'s comment): `Pnt3.toSpherical`/`fromSpherical` measure `theta` from world
      // +X, but this character's local forward is +Y (matching the vehicle axis paradigm), not +X.
      const character = fakeCharacter();
      const camera = fakeCamera();
      camera.rotation = Qtrn.lookAt(Pnt3.O, { x: 1, y: 1, z: 0 });
      const keyboard = new KeyboardInput();
      keyboard.start();
      const controller = new PlayerCharacterController(keyboard, character, camera);
      await controller.onSpawned({} as any);
      controller.tick$.next([0, 16]);

      const forward = Pnt3.rot({ x: 0, y: 1, z: 0 }, character.rotation);
      const expected = Pnt3.norm({ x: 1, y: 1, z: 0 });
      expect(forward.x).toBeCloseTo(expected.x);
      expect(forward.y).toBeCloseTo(expected.y);
      expect(forward.z).toBeCloseTo(0);
    });
  });
});
