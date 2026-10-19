import { DEFAULT_GG_CAR_GAMEPAD_BINDING, GgCarHandlingController, KeyboardInput } from '../../../../../src';
import { MockWorld } from '../../../../mocks/world.mock';
import { stubGamepads } from '../../../../mocks/gamepad.mock';

const fakeCar = (overrides: Partial<any> = {}) =>
  ({
    steeringFactor: 0,
    gear: 1,
    acceleration: 0,
    brake: 0,
    handBrake: false,
    raycastVehicle: { getSpeed: () => 0 },
    carProperties: { transmission: { isAuto: false } },
    ...overrides,
  }) as any;

describe('GgCarHandlingController', () => {
  // `steeringFactor`/`acceleration`/`brake` are only ever written from the child
  // `CarHandlingController`'s tick-driven `output$` (see that class' own spec for why this
  // needs a real `GgWorld` tick loop rather than calling `tick$.next(...)` directly) - deactivating
  // the parent here cascades to the child via ordinary `IEntity.active` parent-checking (the child is
  // added via `addChildren` in the constructor), with no explicit `active` filter of its own on that
  // particular subscription needed.
  const setup = async (options: { neutralGear?: boolean } = {}, carOverrides: Partial<any> = {}) => {
    const world = new MockWorld();
    await world.init();
    const keyboard = new KeyboardInput();
    keyboard.start();
    const car = fakeCar(carOverrides);
    const controller = new GgCarHandlingController(keyboard, car, {
      keymap: 'arrows',
      maxSteerDeltaPerSecond: 1000,
      gearUpDownKeys: ['KeyA', 'KeyZ'],
      autoReverse: true,
      handbrakeKey: 'Space',
      ...options,
    });
    world.addEntity(controller);
    return { world, keyboard, controller, car };
  };

  const tick = (world: MockWorld, elapsed: number, delta: number) =>
    (world.worldClock as any)._tick$.next([elapsed, delta]);

  it('rebinds gear, handbrake and direction keys through setKeys, without touching the options passed in', async () => {
    const world = new MockWorld();
    await world.init();
    const keyboard = new KeyboardInput();
    keyboard.start();
    const car = fakeCar();
    const options = {
      keymap: 'arrows' as const,
      maxSteerDeltaPerSecond: 1000,
      gearUpDownKeys: ['KeyA', 'KeyZ'] as [string, string],
      autoReverse: true,
      handbrakeKey: 'Space',
    };
    const controller = new GgCarHandlingController(keyboard, car, options);
    world.addEntity(controller);

    controller.setKeys({ gearUpDownKeys: ['KeyE', 'KeyQ'], handbrakeKey: 'KeyB', keymap: 'wasd' });
    expect(options.gearUpDownKeys).toEqual(['KeyA', 'KeyZ']);
    expect(controller.options.handbrakeKey).toBe('KeyB');
    expect(controller.carHandlingInput.options.keymap).toBe('wasd');

    keyboard.emulateKeyDown('KeyA');
    expect(car.gear).toBe(1);
    keyboard.emulateKeyDown('KeyE');
    expect(car.gear).toBe(2);
    keyboard.emulateKeyDown('KeyQ');
    expect(car.gear).toBe(1);

    keyboard.emulateKeyDown('Space');
    expect(car.handBrake).toBe(false);
    keyboard.emulateKeyDown('KeyB');
    expect(car.handBrake).toBe(true);

    keyboard.emulateKeyDown('ArrowUp');
    tick(world, 0, 16);
    expect(car.acceleration).toBe(0);
    keyboard.emulateKeyDown('KeyW');
    tick(world, 16, 16);
    expect(car.acceleration).toBeGreaterThan(0);
  });

  it('drives acceleration/steering from held keys while active', async () => {
    const { world, keyboard, car } = await setup();
    keyboard.emulateKeyDown('ArrowUp');
    keyboard.emulateKeyDown('ArrowRight');
    tick(world, 0, 16);

    expect(car.acceleration).toBeGreaterThan(0);
    expect(car.steeringFactor).not.toBe(0);
  });

  it('does not touch the car while inactive, even with keys held down', async () => {
    const { world, keyboard, controller, car } = await setup();
    controller.active = false;

    keyboard.emulateKeyDown('ArrowUp');
    keyboard.emulateKeyDown('ArrowRight');
    keyboard.emulateKeyDown('Space');
    tick(world, 0, 16);

    expect(car.acceleration).toBe(0);
    expect(car.steeringFactor).toBe(0);
    expect(car.handBrake).toBe(false);
  });

  it('resumes driving the car once reactivated', async () => {
    const { world, keyboard, controller, car } = await setup();
    controller.active = false;
    keyboard.emulateKeyDown('ArrowUp');
    tick(world, 0, 16);
    expect(car.acceleration).toBe(0);

    controller.active = true;
    tick(world, 16, 16);
    expect(car.acceleration).toBeGreaterThan(0);
  });

  describe('autoReverse', () => {
    it('brakes a car moving forward with "down" held, without shifting', async () => {
      const { world, keyboard, car } = await setup({}, { raycastVehicle: { getSpeed: () => 10 } });
      keyboard.emulateKeyDown('ArrowDown');
      tick(world, 0, 16);

      expect(car.gear).toBe(1);
      expect(car.brake).toBeGreaterThan(0);
      expect(car.acceleration).toBe(0);
    });

    it('shifts a standing car into reverse on "down" and swaps the keys', async () => {
      const { world, keyboard, car } = await setup();
      keyboard.emulateKeyDown('ArrowDown');
      tick(world, 0, 16);

      expect(car.gear).toBe(-1);
      expect(car.acceleration).toBeGreaterThan(0);
      expect(car.brake).toBe(0);

      // now rolling backwards: "up" is the brake
      car.raycastVehicle.getSpeed = () => -10;
      keyboard.emulateKeyUp('ArrowDown');
      keyboard.emulateKeyDown('ArrowUp');
      tick(world, 16, 16);

      expect(car.gear).toBe(-1);
      expect(car.brake).toBeGreaterThan(0);
      expect(car.acceleration).toBe(0);

      // stopped with "up" still held: back into first gear
      car.raycastVehicle.getSpeed = () => 0;
      tick(world, 32, 16);

      expect(car.gear).toBe(1);
      expect(car.acceleration).toBeGreaterThan(0);
      expect(car.brake).toBe(0);
    });

    it('leaves a car in neutral alone by default', async () => {
      const { world, keyboard, car } = await setup({}, { gear: 0 });
      keyboard.emulateKeyDown('ArrowDown');
      tick(world, 0, 16);

      expect(car.gear).toBe(0);
      expect(car.brake).toBeGreaterThan(0);
    });

    describe('with neutralGear: false', () => {
      it('shifts a car in neutral into first gear on "up"', async () => {
        const { world, keyboard, car } = await setup({ neutralGear: false }, { gear: 0 });
        tick(world, 0, 16);
        expect(car.gear).toBe(0); // no input yet

        keyboard.emulateKeyDown('ArrowUp');
        tick(world, 16, 16);

        expect(car.gear).toBe(1);
        expect(car.acceleration).toBeGreaterThan(0);
      });

      it('shifts a standing car in neutral into reverse on "down"', async () => {
        const { world, keyboard, car } = await setup({ neutralGear: false }, { gear: 0 });
        keyboard.emulateKeyDown('ArrowDown');
        tick(world, 0, 16);

        expect(car.gear).toBe(-1);
        expect(car.acceleration).toBeGreaterThan(0);
        expect(car.brake).toBe(0);
      });

      it('brakes a car rolling forward in neutral on "down"', async () => {
        const { world, keyboard, car } = await setup(
          { neutralGear: false },
          { gear: 0, raycastVehicle: { getSpeed: () => 10 } },
        );
        keyboard.emulateKeyDown('ArrowDown');
        tick(world, 0, 16);

        expect(car.gear).toBe(1);
        expect(car.brake).toBeGreaterThan(0);
        expect(car.acceleration).toBe(0);
      });
    });
  });

  describe('gamepad', () => {
    let pads: ReturnType<typeof stubGamepads>;
    beforeEach(() => (pads = stubGamepads()));
    afterEach(() => pads.restore());

    it('shifts and pedals by the controls given to setGamepad', async () => {
      const { world, controller, car } = await setup();
      controller.setGamepad({ gearUp: 'b3', throttle: 'b0' });
      expect(controller.carHandlingInput.options.gamepad!.throttle).toBe('b0');
      pads.set({ buttons: { 5: true, 7: 1 } });
      world.gamepadInput.poll();
      tick(world, 0, 16);
      expect(car.gear).toBe(1);
      expect(car.acceleration).toBe(0);
      pads.set({ buttons: { 3: true, 0: true } });
      world.gamepadInput.poll();
      tick(world, 16, 16);
      expect(car.gear).toBe(2);
      expect(car.acceleration).toBe(1);
    });

    it('hands the child only its steering and pedal controls, and mirrors changes made on the child', async () => {
      const { controller } = await setup();
      const changes: string[] = [];
      controller.bindingsChanged$.subscribe(c => changes.push(c));
      expect(controller.carHandlingInput.options.gamepad).toEqual({
        steer: DEFAULT_GG_CAR_GAMEPAD_BINDING.steer,
        throttle: 'b7',
        brake: 'b6',
      });
      controller.setGamepad({ gearUp: 'b3', throttle: 'b0' });
      expect(controller.carHandlingInput.options.gamepad).toEqual({
        steer: DEFAULT_GG_CAR_GAMEPAD_BINDING.steer,
        throttle: 'b0',
        brake: 'b6',
      });
      expect(changes).toEqual(['gamepad']);

      // the child's own public API: `options` and `bindingsChanged$` here follow
      controller.carHandlingInput.setKeys({ keymap: 'wasd' });
      expect(controller.options.keymap).toBe('wasd');
      controller.carHandlingInput.setGamepad({ brake: 'b2' });
      expect(controller.options.gamepad!.brake).toBe('b2');
      expect(controller.options.gamepad!.gearUp).toBe('b3');
      controller.carHandlingInput.setGamepad(null);
      expect(controller.options.gamepad).toBeNull();
      expect(changes).toEqual(['gamepad', 'keys', 'gamepad', 'gamepad']);

      // a change made here reaches the child once, and is not mirrored back
      const childChanges: string[] = [];
      controller.carHandlingInput.bindingsChanged$.subscribe(c => childChanges.push(c));
      controller.setKeys({ keymap: 'arrows' });
      controller.setGamepad({ gearDown: 'b9' });
      expect(childChanges).toEqual(['keys', 'gamepad']);
      expect(changes).toEqual(['gamepad', 'keys', 'gamepad', 'gamepad', 'keys', 'gamepad']);
    });

    it('drives, shifts and pulls the handbrake from the world gamepad with the default binding', async () => {
      const { world, car } = await setup();
      world.gamepadInput.poll(); // a binding counts a control from the first read with it released
      pads.set({ axes: [-0.5, 0], buttons: { 7: 1, 5: true, 0: true } });
      world.gamepadInput.poll();
      tick(world, 0, 16);
      expect(car.acceleration).toBe(1);
      expect(car.steeringFactor).toBeGreaterThan(0);
      expect(car.gear).toBe(2);
      expect(car.handBrake).toBe(true);

      pads.set({ buttons: { 4: true } });
      world.gamepadInput.poll();
      expect(car.gear).toBe(1);
      expect(car.handBrake).toBe(false);
    });

    it('leaves the gamepad alone with gamepad: null', async () => {
      const { world, car } = await setup({ gamepad: null } as any);
      pads.set({ buttons: { 7: 1, 5: true, 0: true } });
      world.gamepadInput.poll();
      tick(world, 0, 16);
      expect(car.acceleration).toBe(0);
      expect(car.gear).toBe(1);
      expect(car.handBrake).toBe(false);
    });
  });
});
