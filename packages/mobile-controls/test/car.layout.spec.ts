import { CarHandlingController, GgCarHandlingController, IEntity, TickOrder } from '@gg-web-engine/core';
import { CarLayoutOptions, MobileControls } from '../src';
import { pointer, setRect, TestWorld } from './helpers';

/** An app's own car controller: wraps a bare `CarHandlingController` and handles gears and handbrake itself */
class AppCarController extends IEntity {
  static readonly entityTypeName: string = 'AppCarController';
  public readonly tickOrder = TickOrder.INPUT_CONTROLLERS;
  public readonly input: CarHandlingController;

  constructor(world: TestWorld) {
    super();
    this.input = new CarHandlingController(world.keyboardInput);
    this.addChildren(this.input);
  }
}

describe('car layout', () => {
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
  const control = (controls: MobileControls, id: string) =>
    controls.element.querySelector(`.gg-mc-id-${id}`)! as HTMLElement;
  const spawn = (car: CarLayoutOptions) => {
    const controls = new MobileControls({ enabled: true, car });
    world.addEntity(controls);
    return controls;
  };
  const keyLog = (...codes: string[]) => {
    const log: string[] = [];
    for (const code of codes) {
      world.keyboardInput.bind(code).subscribe(down => log.push(`${code}:${down}`));
    }
    log.length = 0;
    return log;
  };

  it('has a pedal stick in place of the pedal buttons, throttle up and brake down', () => {
    const car = new CarHandlingController(world.keyboardInput);
    world.addEntity(car);
    const controls = spawn({ pedals: 'stick' });
    expect(ids(controls)).toEqual(['steer-left', 'steer-right', 'pedal-stick']);

    const stick = control(controls, 'pedal-stick');
    // base centered at (100, 100), travel 36% of its width
    setRect(stick.firstElementChild!, 50, 50, 100, 100);
    pointer(stick, 'pointerdown', 100, 100);
    pointer(stick, 'pointermove', 140, 64);
    expect(car.directionsInput.direction).toEqual({ x: 0, y: 1 });
    pointer(stick, 'pointermove', 100, 136);
    expect(car.directionsInput.direction).toEqual({ x: 0, y: -1 });

    // steering by its own button adds up with the pedal stick
    pointer(control(controls, 'steer-left'), 'pointerdown', 0, 0, 2);
    expect(car.directionsInput.direction).toEqual({ x: -1, y: -1 });
    pointer(stick, 'pointerup');
    expect(car.directionsInput.direction).toEqual({ x: -1, y: 0 });
  });

  it('presses the throttle and brake keys with the pedal buttons, so both held follow oppositeKeys', () => {
    const car = new CarHandlingController(world.keyboardInput, {
      keymap: 'arrows',
      maxSteerDeltaPerSecond: 12,
      oppositeKeys: { upDown: 'down' },
    });
    world.addEntity(car);
    const controls = spawn({});
    const log = keyLog('ArrowUp', 'ArrowDown');
    pointer(control(controls, 'accelerate'), 'pointerdown', 0, 0, 1);
    expect(car.directionsInput.direction).toEqual({ x: 0, y: 1 });
    pointer(control(controls, 'brake'), 'pointerdown', 0, 0, 2);
    expect(car.directionsInput.direction).toEqual({ x: 0, y: -1 });
    pointer(control(controls, 'brake'), 'pointerup', 0, 0, 2);
    expect(car.directionsInput.direction).toEqual({ x: 0, y: 1 });
    pointer(control(controls, 'accelerate'), 'pointerup', 0, 0, 1);
    expect(log).toEqual(['ArrowUp:true', 'ArrowDown:true', 'ArrowDown:false', 'ArrowUp:false']);

    // with the throttle key of the keyboard too, and on the keys of a new keymap
    car.setKeys({ keymap: { up: ['KeyW', 'ArrowUp'], down: 'KeyS', left: 'KeyA', right: 'KeyD' } });
    world.keyboardInput.emulateKeyDown('KeyW');
    pointer(control(controls, 'brake'), 'pointerdown', 0, 0, 3);
    expect(car.directionsInput.direction).toEqual({ x: 0, y: -1 });
    pointer(control(controls, 'brake'), 'pointerup', 0, 0, 3);
    expect(car.directionsInput.direction).toEqual({ x: 0, y: 1 });
    world.keyboardInput.emulateKeyUp('KeyW');
  });

  it('pushes the direction with the pedal buttons of a controller without keys', () => {
    const car = new CarHandlingController(world.keyboardInput, { keymap: null, maxSteerDeltaPerSecond: 12 });
    world.addEntity(car);
    const controls = spawn({});
    pointer(control(controls, 'accelerate'), 'pointerdown', 0, 0, 1);
    expect(car.directionsInput.direction).toEqual({ x: 0, y: 1 });
    pointer(control(controls, 'brake'), 'pointerdown', 0, 0, 2);
    expect(car.directionsInput.direction).toEqual({ x: 0, y: 0 });
  });

  it('puts the small buttons above a stick higher than above the buttons', () => {
    world.addEntity(new GgCarHandlingController(world.keyboardInput, null));
    const buttons = spawn({ gears: true });
    expect(control(buttons, 'handbrake').style.bottom).toContain('(16 +');
    expect(control(buttons, 'gear-up').style.bottom).toContain('(16 +');
    world.removeEntity(buttons, true);

    const sticks = spawn({ gears: true, steering: 'stick', pedals: 'stick' });
    expect(ids(sticks)).toEqual(['steer-stick', 'pedal-stick', 'handbrake', 'gear-down', 'gear-up']);
    expect(control(sticks, 'handbrake').style.bottom).toContain('(20 +');
    expect(control(sticks, 'gear-down').style.bottom).toContain('(20 +');
  });

  it('gives a bare CarHandlingController handbrake and gear buttons for the keys it is given', () => {
    const app = new AppCarController(world);
    world.addEntity(app);
    const controls = spawn({ keys: { handbrake: 'Space', gearUp: 'KeyE', gearDown: 'KeyQ' } });
    expect(ids(controls)).toEqual([
      'steer-left',
      'steer-right',
      'accelerate',
      'brake',
      'handbrake',
      'gear-down',
      'gear-up',
    ]);

    const log = keyLog('Space', 'KeyE', 'KeyQ');
    pointer(control(controls, 'handbrake'), 'pointerdown', 0, 0, 1);
    pointer(control(controls, 'gear-up'), 'pointerdown', 0, 0, 2);
    pointer(control(controls, 'gear-up'), 'pointerup', 0, 0, 2);
    pointer(control(controls, 'gear-down'), 'pointerdown', 0, 0, 3);
    expect(log).toEqual(['Space:true', 'KeyE:true', 'KeyE:false', 'KeyQ:true']);
  });

  it('leaves out what has no key, what is switched off, and every button without keys', () => {
    const app = new AppCarController(world);
    world.addEntity(app);
    const partial = spawn({ keys: { gearUp: 'KeyE' } });
    expect(ids(partial)).toEqual(['steer-left', 'steer-right', 'accelerate', 'brake', 'gear-up']);
    world.removeEntity(partial, true);

    const off = spawn({
      keys: { handbrake: 'Space', gearUp: 'KeyE', gearDown: 'KeyQ' },
      gears: false,
      handbrake: false,
    });
    expect(ids(off)).toEqual(['steer-left', 'steer-right', 'accelerate', 'brake']);
    world.removeEntity(off, true);

    const none = spawn({ gears: true });
    expect(ids(none)).toEqual(['steer-left', 'steer-right', 'accelerate', 'brake']);
  });

  it('reads the keys from a function each time the layout is built', () => {
    const app = new AppCarController(world);
    world.addEntity(app);
    let gearUp = 'KeyE';
    const keys = jest.fn((controller: CarHandlingController) => ({ gearUp, parent: controller.parent }));
    const controls = spawn({ keys });
    expect(keys).toHaveBeenCalledWith(app.input);
    expect(keys.mock.results[0].value.parent).toBe(app);

    // the app rebinds its keys; the controller's own `setKeys` (or `refresh`) builds the layout again
    gearUp = 'KeyR';
    app.input.setKeys({ keymap: 'arrows' });
    const log = keyLog('KeyE', 'KeyR');
    pointer(control(controls, 'gear-up'), 'pointerdown');
    expect(log).toEqual(['KeyR:true']);
  });

  it('never takes the keys option for a GgCarHandlingController', () => {
    const car = new GgCarHandlingController(world.keyboardInput, null);
    car.setKeys({ handbrakeKey: 'KeyB' });
    world.addEntity(car);
    const keys = jest.fn(() => ({ handbrake: 'Space' }));
    const controls = spawn({ keys });
    const log = keyLog('Space', 'KeyB');
    pointer(control(controls, 'handbrake'), 'pointerdown');
    expect(log).toEqual(['KeyB:true']);
    expect(keys).not.toHaveBeenCalled();
  });
});
