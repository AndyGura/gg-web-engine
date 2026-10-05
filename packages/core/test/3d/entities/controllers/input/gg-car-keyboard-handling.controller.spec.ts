import { GgCarKeyboardHandlingController, KeyboardInput } from '../../../../../src';
import { MockWorld } from '../../../../mocks/world.mock';

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

describe('GgCarKeyboardHandlingController', () => {
  // `steeringFactor`/`acceleration`/`brake` are only ever written from the child
  // `CarKeyboardHandlingController`'s tick-driven `output$` (see that class' own spec for why this
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
    const controller = new GgCarKeyboardHandlingController(keyboard, car, {
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
});
