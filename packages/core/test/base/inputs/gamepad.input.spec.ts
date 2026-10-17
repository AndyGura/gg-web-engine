import { DirectionInput, GAMEPAD_LEFT_STICK, GamepadControl, GamepadInput, KeyboardInput, Point2 } from '../../../src';
import { MockWorld } from '../../mocks/world.mock';
import { FakeGamepad, fakeGamepad, stubGamepads } from '../../mocks/gamepad.mock';

describe('GamepadInput', () => {
  let pads: ReturnType<typeof stubGamepads>;
  let input: GamepadInput;

  beforeEach(() => {
    pads = stubGamepads();
    input = new GamepadInput();
    input.start();
  });

  afterEach(() => {
    input.stop();
    pads.restore();
  });

  const connect = (pad: FakeGamepad = {}) => {
    pads.set(pad);
    input.poll();
  };

  it('reads buttons, triggers and stick axes past their dead zones', () => {
    connect({ buttons: { 0: true, 7: 0.6, 6: 0.01 }, axes: [0.56, -1, 0.05, 0] });
    expect(input.value('b0')).toBe(1);
    expect(input.value('b7')).toBe(0.6);
    expect(input.value('b6')).toBe(0); // inside the trigger dead zone
    expect(input.value('a0+')).toBeCloseTo((0.56 - 0.12) / 0.88);
    expect(input.value('a0-')).toBe(0);
    expect(input.value('a1-')).toBe(1);
    expect(input.value('a2+')).toBe(0); // inside the stick dead zone
    expect(input.value('b99')).toBe(0);
    expect(input.value(['b6', 'b7'])).toBe(0.6); // the most pushed one
    expect(input.connected).toBe(true);
    expect(input.standardMapping).toBe(true);
  });

  it('reports pressed$ edges past the press threshold', () => {
    const values: boolean[] = [];
    input.pressed$('b7').subscribe(v => values.push(v));
    connect({ buttons: { 7: 0.3 } });
    connect({ buttons: { 7: 0.7 } });
    connect({ buttons: { 7: 0.9 } });
    connect({ buttons: { 7: 0 } });
    expect(values).toEqual([false, true, false]);
  });

  it('reads a direction binding with x to the right and y up', () => {
    connect({ axes: [-1, -1] });
    expect(input.direction(GAMEPAD_LEFT_STICK)).toEqual({ x: -1, y: 1 });
    const values: Point2[] = [];
    input.direction$({ x: { negative: 'b14', positive: 'b15' } }).subscribe(v => values.push(v));
    connect({ buttons: { 15: true } });
    connect({ buttons: { 15: true } });
    connect({ buttons: { 14: true } });
    expect(values).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: -1, y: 0 },
    ]);
  });

  it('holds keys of a keyboard while the bound controls are pressed, and lets go when unbound', () => {
    const keyboard = new KeyboardInput();
    keyboard.start();
    const space: boolean[] = [];
    const e: boolean[] = [];
    keyboard.bind('Space').subscribe(v => space.push(v));
    keyboard.bind('KeyE').subscribe(v => e.push(v));
    const unbind = input.bindKeys(keyboard, { Space: 'b0', KeyE: ['b2', 'b5'] });

    connect({ buttons: { 0: true } });
    connect({ buttons: { 0: true, 5: true } });
    connect({ buttons: { 5: true } });
    expect(space).toEqual([false, true, false]);
    expect(e).toEqual([false, true]);

    unbind();
    expect(e).toEqual([false, true, false]);
    connect({ buttons: { 0: true } });
    expect(space).toEqual([false, true, false]);
    keyboard.stop();
  });

  it('holds a key again after the keyboard was restarted with the control still pressed', () => {
    const keyboard = new KeyboardInput();
    keyboard.start();
    const space: boolean[] = [];
    keyboard.bind('Space').subscribe(v => space.push(v));
    input.bindKeys(keyboard, { Space: 'b0' });
    connect({ buttons: { 0: true } });
    keyboard.stop();
    keyboard.start();
    expect(space).toEqual([false, true, false]);
    connect({ buttons: { 0: true } });
    expect(space).toEqual([false, true, false, true]);
    keyboard.stop();
  });

  it('feeds a direction input with the stick and withdraws it when centered, stopped or unbound', () => {
    const direction = new DirectionInput();
    direction.start();
    const unbind = input.bindDirection(direction, GAMEPAD_LEFT_STICK);
    connect({ axes: [1, 0] });
    expect(direction.direction).toEqual({ x: 1, y: 0 });
    connect({ axes: [0, 0] });
    expect(direction.direction).toEqual({ x: 0, y: 0 });

    connect({ axes: [1, 0] });
    direction.stop();
    direction.start();
    expect(direction.direction).toEqual({ x: 0, y: 0 });
    input.poll(); // the same stick position, fed again
    expect(direction.direction).toEqual({ x: 1, y: 0 });

    unbind();
    expect(direction.direction).toEqual({ x: 0, y: 0 });
    input.bindDirection(direction, GAMEPAD_LEFT_STICK);
    input.poll();
    expect(direction.direction).toEqual({ x: 1, y: 0 });
    input.stop();
    expect(direction.direction).toEqual({ x: 0, y: 0 });
    direction.stop();
  });

  it('lets go of everything when the gamepad disconnects', () => {
    const keyboard = new KeyboardInput();
    keyboard.start();
    const space: boolean[] = [];
    keyboard.bind('Space').subscribe(v => space.push(v));
    input.bindKeys(keyboard, { Space: 'b0' });
    connect({ buttons: { 0: true } });
    pads.set(null);
    input.poll();
    expect(space).toEqual([false, true, false]);
    expect(input.connected).toBe(false);
    expect(input.gamepad).toBeNull();
    keyboard.stop();
  });

  it('reads the gamepad at gamepadIndex only when one is set', () => {
    const indexed = new GamepadInput({ gamepadIndex: 1 });
    indexed.start();
    pads.setAll([fakeGamepad({ buttons: { 0: true } }), null]);
    indexed.poll();
    expect(indexed.connected).toBe(false);
    pads.setAll([fakeGamepad({ buttons: { 0: true } }), fakeGamepad({ buttons: { 1: true } })]);
    indexed.poll();
    expect(indexed.value('b0')).toBe(0);
    expect(indexed.value('b1')).toBe(1);
    indexed.stop();
  });

  it('is in use from the first control pushed until a real key or pointer press', () => {
    const values: boolean[] = [];
    input.inUse$.subscribe(v => values.push(v));
    connect();
    expect(input.inUse).toBe(false);
    connect({ axes: [0.5, 0] });
    expect(input.inUse).toBe(true);
    connect();
    expect(input.inUse).toBe(true); // released controls do not hand over
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
    expect(input.inUse).toBe(false);
    connect({ buttons: { 0: true } });
    window.dispatchEvent(new MouseEvent('pointerdown'));
    expect(values).toEqual([false, true, false, true, false]);
  });

  it('is not in use by an axis resting off center, only by one that moved', () => {
    connect({ axes: [0, 0, 0, 0, -1] }); // a trigger reported as an axis rests at -1
    connect({ axes: [0, 0, 0, 0, -1] });
    expect(input.inUse).toBe(false);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
    connect({ axes: [0, 0, 0, 0, -1] });
    expect(input.inUse).toBe(false);
    connect({ axes: [0, 0, 0, 0, -0.5] });
    expect(input.inUse).toBe(true);
  });

  it('stays in use while stopped, and gives it up only when the gamepad is gone', () => {
    connect({ buttons: { 0: true } });
    expect(input.inUse).toBe(true);
    input.stop();
    expect(input.inUse).toBe(true);
    input.start();
    connect({ buttons: { 0: true } });
    expect(input.inUse).toBe(true);
    pads.set(null);
    input.poll();
    expect(input.inUse).toBe(false);
  });

  it('reads no gamepad when getGamepads() throws', () => {
    Object.defineProperty(navigator, 'getGamepads', {
      value: () => {
        throw new DOMException('denied', 'SecurityError');
      },
      configurable: true,
      writable: true,
    });
    expect(() => input.poll()).not.toThrow();
    expect(input.connected).toBe(false);
  });

  it('keeps holding a key when the same physical key is released', () => {
    const keyboard = new KeyboardInput();
    keyboard.start();
    const space: boolean[] = [];
    keyboard.bind('Space').subscribe(v => space.push(v));
    input.bindKeys(keyboard, { Space: 'b0' });
    connect({ buttons: { 0: true } });
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }));
    connect({ buttons: { 0: true } });
    expect(space).toEqual([false, true]); // no second press
    connect({ buttons: { 0: false } });
    expect(space).toEqual([false, true, false]);
    keyboard.stop();
  });

  it('emits each control on the poll it becomes pushed, raw', () => {
    const pushed: GamepadControl[] = [];
    input.controlPushed$.subscribe(c => pushed.push(c));
    connect({ buttons: { 7: 0.6 }, axes: [0, -0.8] });
    connect({ buttons: { 7: 0.6 }, axes: [0, -0.8] });
    connect({ buttons: { 7: 0.4 }, axes: [0.9, 0] });
    expect(pushed).toEqual(['b7', 'a1-', 'a0+']);
  });

  it('ignores polls while stopped', () => {
    input.stop();
    pads.set({ buttons: { 0: true } });
    input.poll();
    expect(input.value('b0')).toBe(0);
    expect(input.connected).toBe(false);
  });

  it('names controls for menus', () => {
    expect(GamepadInput.controlName('b0')).toBe('A');
    expect(GamepadInput.controlName('b7')).toBe('RT');
    expect(GamepadInput.controlName('a0-')).toBe('L stick left');
    expect(GamepadInput.controlName('a3+')).toBe('R stick down');
    expect(GamepadInput.controlName('b20')).toBe('Button 21');
    expect(GamepadInput.controlName('b0', false)).toBe('Button 1');
    expect(GamepadInput.controlName('a2-', false)).toBe('Axis 3-');
    expect(GamepadInput.isControl('a2-')).toBe(true);
    expect(GamepadInput.isControl('a2')).toBe(false);
    expect(GamepadInput.isControl('x1')).toBe(false);
  });

  it('is started by the world and stopped with its inputEnabled', () => {
    const world = new MockWorld();
    expect(world.gamepadInput.running).toBe(true);
    world.inputEnabled = false;
    expect(world.gamepadInput.running).toBe(false);
    world.inputEnabled = true;
    expect(world.gamepadInput.running).toBe(true);
    world.dispose();
    expect(world.gamepadInput.running).toBe(false);
  });
});
