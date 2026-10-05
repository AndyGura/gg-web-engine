import {
  CarHandlingController,
  GgCarHandlingController,
  IEntity,
  PlayerCharacterController2d,
  TickOrder,
} from '@gg-web-engine/core';
import { MOBILE_CONTROLS_STYLE_ID, MobileControls, TouchButton } from '../src';
import { pointer, TestWorld, tick } from './helpers';

class CustomController extends IEntity {
  static readonly entityTypeName: string = 'CustomController';
  public readonly tickOrder = TickOrder.INPUT_CONTROLLERS;
}

describe('MobileControls', () => {
  let world: TestWorld;

  beforeEach(async () => {
    world = new TestWorld();
    await world.init();
  });

  afterEach(() => {
    world.dispose();
    document.body.innerHTML = '';
  });

  const ids = (controls: MobileControls) =>
    [...controls.element.querySelectorAll('[data-gg-mc]')].map(e => (e as HTMLElement).dataset.ggMc);
  const control = (controls: MobileControls, id: string) => controls.element.querySelector(`.gg-mc-id-${id}`)!;

  it('stays off the page on a device that is not touch-first, unless enabled outright', () => {
    const auto = new MobileControls();
    world.addEntity(auto);
    expect(auto.shown).toBe(false);

    auto.enabled = true;
    expect(auto.shown).toBe(true);
    expect(auto.element.parentElement).toBe(document.body);
    expect(document.getElementById(MOBILE_CONTROLS_STYLE_ID)).not.toBeNull();
  });

  it('goes by the pointer media query in auto mode', () => {
    window.matchMedia = ((query: string) => ({ matches: query === '(pointer: coarse)' })) as any;
    const controls = new MobileControls();
    world.addEntity(controls);
    expect(controls.shown).toBe(true);
    delete (window as any).matchMedia;
  });

  it('shows the layout of an active controller and swaps it as controllers change', () => {
    const car = new GgCarHandlingController(world.keyboardInput, null);
    world.addEntity(car);
    const controls = new MobileControls({ enabled: true });
    world.addEntity(controls);
    expect(ids(controls)).toEqual(['steer-left', 'steer-right', 'accelerate', 'brake', 'handbrake', 'gear-down', 'gear-up']);

    const player = new PlayerCharacterController2d(world.keyboardInput, null, {} as any);
    player.active = false;
    world.addEntity(player);
    expect(ids(controls)).not.toContain('jump');

    car.active = false;
    player.active = true;
    tick(world);
    expect(ids(controls)).toEqual(['move-left', 'move-right', 'jump', 'run', 'crouch']);
    expect(controls.activeControllers).toEqual([player]);

    world.removeEntity(player);
    expect(ids(controls)).toEqual([]);
  });

  it('drives the car controller from the steering and pedal buttons', () => {
    const car = new GgCarHandlingController(world.keyboardInput, null, {
      keymap: 'arrows',
      maxSteerDeltaPerSecond: 1000,
      gearUpDownKeys: ['KeyA', 'KeyZ'],
      autoReverse: true,
      handbrakeKey: 'Space',
    });
    world.addEntity(car);
    const controls = new MobileControls({ enabled: true });
    world.addEntity(controls);
    const outputs: any[] = [];
    car.carHandlingInput.output$.subscribe(o => outputs.push(o));

    pointer(control(controls, 'steer-left'), 'pointerdown', 0, 0, 1);
    pointer(control(controls, 'accelerate'), 'pointerdown', 0, 0, 2);
    tick(world);
    expect(outputs[outputs.length - 1]).toEqual({ upDown: 1, leftRight: 1 });

    pointer(control(controls, 'steer-left'), 'pointerup', 0, 0, 1);
    pointer(control(controls, 'accelerate'), 'pointerup', 0, 0, 2);
    pointer(control(controls, 'brake'), 'pointerdown', 0, 0, 3);
    tick(world, 16);
    expect(outputs[outputs.length - 1]).toEqual({ upDown: -1, leftRight: 0 });
  });

  it('gives a bare CarHandlingController the steering and the pedals alone', () => {
    world.addEntity(new CarHandlingController(world.keyboardInput));
    const controls = new MobileControls({ enabled: true });
    world.addEntity(controls);
    expect(ids(controls)).toEqual(['steer-left', 'steer-right', 'accelerate', 'brake']);
  });

  it('releases what is held when the layout goes away', () => {
    const player = new PlayerCharacterController2d(world.keyboardInput, null, {} as any);
    world.addEntity(player);
    const controls = new MobileControls({ enabled: true });
    world.addEntity(controls);
    const run: boolean[] = [];
    world.keyboardInput.bind('ShiftLeft').subscribe(v => run.push(v));

    pointer(control(controls, 'run'), 'pointerdown');
    pointer(control(controls, 'run'), 'pointerup');
    pointer(control(controls, 'move-right'), 'pointerdown', 0, 0, 2);
    expect(run).toEqual([false, true]);
    expect(player.directionsInput.direction.x).toBe(1);

    controls.visible = false;
    expect(run).toEqual([false, true, false]);
    expect(player.directionsInput.direction.x).toBe(0);
    expect(controls.shown).toBe(false);
  });

  it('applies layout options: variants, hidden controls, placements, icons and extra controls', () => {
    world.addEntity(new GgCarHandlingController(world.keyboardInput, null));
    const controls = new MobileControls({
      enabled: true,
      car: {
        steering: 'stick',
        gears: true,
        hide: ['handbrake'],
        placements: { brake: { left: 30 } },
        icons: { accelerate: 'GO' },
        extra: () => [new TouchButton({ id: 'horn', content: 'H' })],
      },
    });
    world.addEntity(controls);

    expect(ids(controls)).toEqual(['steer-stick', 'accelerate', 'brake', 'gear-down', 'gear-up', 'horn']);
    expect(control(controls, 'accelerate').textContent).toBe('GO');
    const brake = control(controls, 'brake') as HTMLElement;
    expect(brake.style.left).toContain('30');
    expect(brake.style.right).toBe('');
  });

  it('takes a layout for any controller class, replacing or dropping a built-in one', () => {
    const custom = new CustomController();
    world.addEntity(custom);
    world.addEntity(new GgCarHandlingController(world.keyboardInput, null));
    const controls = new MobileControls({ enabled: true, car: false });
    world.addEntity(controls);
    expect(ids(controls)).toEqual([]);

    const pressed = jest.fn();
    controls.registerLayout(CustomController, () => [new TouchButton({ id: 'fire' }).onPress(pressed)]);
    expect(ids(controls)).toEqual(['fire']);
    pointer(control(controls, 'fire'), 'pointerdown');
    expect(pressed).toHaveBeenCalledTimes(1);

    controls.registerLayout(CustomController, null);
    expect(ids(controls)).toEqual([]);
  });

  it('keeps its own controls on top of every layout, and inside a given container', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const controls = new MobileControls({ enabled: true, container });
    const pause = new TouchButton({ id: 'pause' });
    controls.addControls(pause);
    world.addEntity(controls);
    world.addEntity(new PlayerCharacterController2d(world.keyboardInput, null, {} as any));

    expect(controls.element.parentElement).toBe(container);
    expect(controls.element.classList.contains('gg-mc--contained')).toBe(true);
    expect(ids(controls).pop()).toBe('pause');

    world.removeEntity(controls);
    expect(controls.shown).toBe(false);
    expect(controls.element.querySelector('.gg-mc-id-jump')).toBeNull();
  });

  it('leaves the screen while the world input is switched off, even with the world paused, and comes back', () => {
    const car = new GgCarHandlingController(world.keyboardInput, null);
    world.addEntity(car);
    const controls = new MobileControls({ enabled: true });
    world.addEntity(controls);
    const pause = new TouchButton({ id: 'pause' });
    controls.addControls(pause);
    expect(controls.shown).toBe(true);

    // what a ScreenManager does to the world of a covered screen: no tick follows
    world.pauseWorld();
    world.inputEnabled = false;
    expect(controls.shown).toBe(false);
    expect(ids(controls)).toEqual(['pause']);

    world.inputEnabled = true;
    expect(controls.shown).toBe(true);
    expect(ids(controls)).toContain('accelerate');
  });
});
