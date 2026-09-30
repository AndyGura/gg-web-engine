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
  const setup = async () => {
    const world = new MockWorld();
    await world.init();
    const keyboard = new KeyboardInput();
    keyboard.start();
    const car = fakeCar();
    const controller = new GgCarKeyboardHandlingController(keyboard, car, {
      keymap: 'arrows',
      maxSteerDeltaPerSecond: 1000,
      gearUpDownKeys: ['KeyA', 'KeyZ'],
      autoReverse: true,
      handbrakeKey: 'Space',
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
});
