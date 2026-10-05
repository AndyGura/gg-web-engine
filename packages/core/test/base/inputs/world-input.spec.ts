import { KeyboardInput, MouseInput } from '../../../src';
import { MockWorld } from '../../mocks/world.mock';

describe('GgWorld.inputEnabled', () => {
  it('stops and restarts the world keyboard, and reports every change', () => {
    const world = new MockWorld();
    const values: boolean[] = [];
    world.inputEnabled$.subscribe(v => values.push(v));

    world.inputEnabled = false;
    world.inputEnabled = false;
    expect(world.keyboardInput.running).toBe(false);
    world.inputEnabled = true;
    expect(world.keyboardInput.running).toBe(true);
    expect(values).toEqual([true, false, true]);
    world.dispose();
  });

  it('does not affect the clock: a world with input off keeps ticking', async () => {
    const world = new MockWorld();
    await world.init();
    world.start();
    world.inputEnabled = false;
    expect(world.isPaused).toBe(false);
    world.dispose();
  });

  it('tells its audio scene when it pauses and resumes', async () => {
    const world = new MockWorld();
    const setPaused = jest.fn();
    (world as any).audioScene = { setPaused, init: async () => {}, update: () => {}, dispose: () => {} };
    await world.init();
    world.start();
    world.pauseWorld();
    world.resumeWorld();
    expect(setPaused.mock.calls).toEqual([[true], [false]]);
    world.dispose();
  });
});

describe('inputs across a stop and restart', () => {
  it('KeyboardInput removes every listener it added when stopped', () => {
    const spies = [
      jest.spyOn(window, 'addEventListener'),
      jest.spyOn(window, 'removeEventListener'),
      jest.spyOn(document, 'addEventListener'),
      jest.spyOn(document, 'removeEventListener'),
    ];
    const keyboard = new KeyboardInput();
    keyboard.start();
    keyboard.stop();
    expect(spies[0].mock.calls.length).toBe(spies[1].mock.calls.length);
    expect(spies[2].mock.calls.length).toBe(spies[3].mock.calls.length);
    jest.restoreAllMocks();
  });

  it('MouseInput keeps a wheel subscriber through a restart, and is silent while stopped', () => {
    const mouse = new MouseInput();
    const wheel = jest.fn();
    mouse.start();
    mouse.wheel$.subscribe(wheel);
    const scroll = () => window.dispatchEvent(new WheelEvent('wheel', { deltaY: 3, cancelable: true }));

    scroll();
    mouse.stop();
    scroll();
    mouse.start();
    scroll();
    expect(wheel.mock.calls).toEqual([[3], [3]]);
    mouse.stop();
  });
});
