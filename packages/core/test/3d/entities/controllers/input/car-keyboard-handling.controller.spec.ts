import { CarKeyboardHandlingController, KeyboardInput } from '../../../../../src';
import { MockWorld } from '../../../../mocks/world.mock';

describe('CarKeyboardHandlingController', () => {
  // `output$` is only ever pushed from this controller's own `tick$` subscription (see the class'
  // source) - it carries no `active` filter of its own, relying entirely on `GgWorld` never
  // delivering a tick to an inactive entity in the first place (see `GgWorld`'s own `forwardTick`,
  // which checks `listener.active` before firing `tick$`). That's only exercised by driving a real
  // `GgWorld` tick loop - calling `controller.tick$.next(...)` directly, as most other controller
  // specs do, would bypass that gate entirely and could pass even if the gate were broken.
  const setup = async (options: Partial<any> = {}) => {
    const world = new MockWorld();
    await world.init();
    const keyboard = new KeyboardInput();
    keyboard.start();
    const controller = new CarKeyboardHandlingController(keyboard, {
      keymap: 'arrows',
      maxSteerDeltaPerSecond: 1000,
      ...options,
    });
    world.addEntity(controller);
    return { world, keyboard, controller };
  };

  const tick = (world: MockWorld, elapsed: number, delta: number) =>
    (world.worldClock as any)._tick$.next([elapsed, delta]);

  it('emits output on tick while active', async () => {
    const { world, keyboard, controller } = await setup();
    const outputs: any[] = [];
    controller.output$.subscribe(o => outputs.push(o));

    keyboard.emulateKeyDown('ArrowUp');
    tick(world, 0, 16);

    expect(outputs).toHaveLength(1);
    expect(outputs[0].upDown).toBe(1);
  });

  it('emits nothing while inactive, because GgWorld never delivers it a tick', async () => {
    const { world, keyboard, controller } = await setup();
    const outputs: any[] = [];
    controller.output$.subscribe(o => outputs.push(o));

    controller.active = false;
    keyboard.emulateKeyDown('ArrowUp');
    tick(world, 0, 16);

    expect(outputs).toHaveLength(0);
  });

  it('resumes emitting once reactivated', async () => {
    const { world, keyboard, controller } = await setup();
    const outputs: any[] = [];
    controller.output$.subscribe(o => outputs.push(o));

    controller.active = false;
    keyboard.emulateKeyDown('ArrowUp');
    tick(world, 0, 16);
    expect(outputs).toHaveLength(0);

    controller.active = true;
    tick(world, 16, 16);
    expect(outputs).toHaveLength(1);
  });
});
