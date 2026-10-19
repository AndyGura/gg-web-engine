import { CarHandlingController, KeyboardInput } from '../../../../../src';
import { MockWorld } from '../../../../mocks/world.mock';
import { stubGamepads } from '../../../../mocks/gamepad.mock';

describe('CarHandlingController', () => {
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
    const controller = new CarHandlingController(keyboard, {
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

  describe('gamepad', () => {
    let pads: ReturnType<typeof stubGamepads>;
    beforeEach(() => (pads = stubGamepads()));
    afterEach(() => pads.restore());

    it('pedals by the controls given to setGamepad', async () => {
      const { world, controller } = await setup();
      const outputs: any[] = [];
      controller.output$.subscribe(o => outputs.push(o));
      controller.setGamepad({ throttle: 'b0' });
      pads.set({ buttons: { 7: 1 } });
      world.gamepadInput.poll();
      tick(world, 0, 16);
      pads.set({ buttons: { 0: true } });
      world.gamepadInput.poll();
      tick(world, 16, 16);
      expect(outputs.map(o => o.upDown)).toEqual([0, 1]);
    });

    it('steers and pedals from the world gamepad with the default binding', async () => {
      const { world, controller } = await setup();
      const outputs: any[] = [];
      controller.output$.subscribe(o => outputs.push(o));

      pads.set({ axes: [1, 0], buttons: { 7: 0.8 } });
      world.gamepadInput.poll();
      tick(world, 0, 16);
      expect(outputs[0]).toEqual({ upDown: 0.8, leftRight: -1 }); // leftRight is positive to the left

      pads.set({ buttons: { 14: true, 6: true } }); // d-pad left, left trigger
      world.gamepadInput.poll();
      tick(world, 16, 16);
      expect(outputs[1]).toEqual({ upDown: -1, leftRight: 1 });
    });

    it('takes a custom binding, and none with gamepad: null', async () => {
      const custom = await setup({
        gamepad: { steer: { negative: 'b4', positive: 'b5' }, throttle: 'b0', brake: 'b1' },
      });
      const off = await setup({ gamepad: null });
      const customOutputs: any[] = [];
      const offOutputs: any[] = [];
      custom.controller.output$.subscribe(o => customOutputs.push(o));
      off.controller.output$.subscribe(o => offOutputs.push(o));

      pads.set({ buttons: { 5: true, 0: true }, axes: [-1, 0] });
      custom.world.gamepadInput.poll();
      off.world.gamepadInput.poll();
      tick(custom.world, 0, 16);
      tick(off.world, 0, 16);
      expect(customOutputs[0]).toEqual({ upDown: 1, leftRight: -1 });
      expect(offOutputs[0]).toEqual({ upDown: 0, leftRight: 0 });
    });

    it('lets go of the gamepad when removed from the world', async () => {
      const { world, controller } = await setup();
      pads.set({ axes: [1, 0] });
      world.gamepadInput.poll();
      expect(controller.directionsInput.direction.x).toBe(1);
      world.removeEntity(controller);
      // the direction input is stopped on removal; a started one gets nothing more from the gamepad
      controller.directionsInput.start();
      world.gamepadInput.poll();
      expect(controller.directionsInput.direction.x).toBe(0);
      controller.directionsInput.stop();
    });
  });
});
