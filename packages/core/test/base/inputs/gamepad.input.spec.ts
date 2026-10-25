import {
  DirectionInput,
  GAMEPAD_LEFT_STICK,
  GamepadControl,
  GamepadInput,
  GgGlobalClock,
  KeyboardInput,
  Point2,
} from '../../../src';
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
    GamepadInput.choice = null;
    (GamepadInput as any).knownGamepads.length = 0;
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

  describe('bindKeys options', () => {
    let keyboard: KeyboardInput;
    let now: number;
    beforeEach(() => {
      keyboard = new KeyboardInput();
      keyboard.start();
      now = 0;
      jest.spyOn(performance, 'now').mockImplementation(() => now);
    });
    afterEach(() => {
      keyboard.stop();
      jest.restoreAllMocks();
    });

    it('with edge, presses only for a control pushed while the keyboard runs', () => {
      const enter: boolean[] = [];
      keyboard.bind('Enter').subscribe(v => enter.push(v));
      connect({ buttons: { 0: true } });
      input.bindKeys(keyboard, { Enter: 'b0' }, { edge: true });
      // held when bound: not a press
      connect({ buttons: { 0: true } });
      connect({});
      connect({ buttons: { 0: true } });
      expect(enter).toEqual([false, true]);

      // still held across a keyboard restart: let go of, and not pressed again
      keyboard.stop();
      keyboard.start();
      connect({ buttons: { 0: true } });
      expect(enter).toEqual([false, true, false]);
      connect({});
      // pushed while the keyboard is stopped: nothing once it runs again
      keyboard.stop();
      connect({ buttons: { 0: true } });
      keyboard.start();
      connect({ buttons: { 0: true } });
      expect(enter).toEqual([false, true, false]);
      connect({});
      connect({ buttons: { 0: true } });
      expect(enter).toEqual([false, true, false, true]);
    });

    it('with edge, does not press for a control held when the input first reads the gamepad', () => {
      const escape: boolean[] = [];
      keyboard.bind('Escape').subscribe(v => escape.push(v));
      // a fresh input, never polled: the binding is made with no state of the gamepad
      const fresh = new GamepadInput();
      pads.set({ buttons: { 1: true } });
      fresh.bindKeys(keyboard, { Escape: 'b1' }, { edge: true });
      fresh.start();
      fresh.poll();
      expect(escape).toEqual([false]);
      pads.set({});
      fresh.poll();
      pads.set({ buttons: { 1: true } });
      fresh.poll();
      expect(escape).toEqual([false, true]);
      // stopped and started again with the button still held: not a press either
      fresh.stop();
      expect(escape).toEqual([false, true, false]);
      fresh.start();
      fresh.poll();
      expect(escape).toEqual([false, true, false]);
      pads.set({});
      fresh.poll();
      pads.set({ buttons: { 1: true } });
      fresh.poll();
      expect(escape).toEqual([false, true, false, true]);
      fresh.stop();
    });

    it('repeats the keys in repeat while held, after the delay and then every interval', () => {
      const down: number[] = [];
      keyboard.bind('ArrowDown').subscribe(v => v && down.push(now));
      const enter: number[] = [];
      keyboard.bind('Enter').subscribe(v => v && enter.push(now));
      input.bindKeys(keyboard, { ArrowDown: 'b13', Enter: 'b0' }, { edge: true, repeat: ['ArrowDown'] });
      connect({});
      connect({ buttons: { 13: true, 0: true } });
      for (now = 50; now <= 700; now += 50) {
        connect({ buttons: { 13: true, 0: true } });
      }
      // repeats come on the polls: 350, 475 (poll at 500), 600, 725 (poll at 750)
      expect(down).toEqual([0, 350, 500, 600]);
      expect(enter).toEqual([0]);

      // a stalled frame: one repeat, the next a full interval later
      now = 2000;
      connect({ buttons: { 13: true } });
      now = 2050;
      connect({ buttons: { 13: true } });
      now = 2125;
      connect({ buttons: { 13: true } });
      expect(down).toEqual([0, 350, 500, 600, 2000, 2125]);

      connect({});
      now = 3000;
      connect({});
      expect(down.length).toBe(6);
    });

    it('stops repeating with edge once the keyboard stops', () => {
      const down: number[] = [];
      keyboard.bind('ArrowDown').subscribe(v => v && down.push(now));
      input.bindKeys(keyboard, { ArrowDown: 'b13' }, { edge: true, repeat: ['ArrowDown'] });
      connect({});
      connect({ buttons: { 13: true } });
      keyboard.stop();
      keyboard.start();
      now = 1000;
      connect({ buttons: { 13: true } });
      expect(down).toEqual([0]);
    });
  });

  it('presses a key let go of by a restarted keyboard only once its control is pushed again', () => {
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
    expect(space).toEqual([false, true, false]);
    connect({ buttons: {} });
    connect({ buttons: { 0: true } });
    expect(space).toEqual([false, true, false, true]);
    keyboard.stop();
  });

  it('does not press a key for a control held through a stop of the gamepad input (a pause menu closed with it)', () => {
    const keyboard = new KeyboardInput();
    keyboard.start();
    const space: boolean[] = [];
    keyboard.bind('Space').subscribe(v => space.push(v));
    input.bindKeys(keyboard, { Space: 'b0' });
    connect({ buttons: {} });
    input.stop();
    input.start();
    connect({ buttons: { 0: true } });
    expect(space).toEqual([false]);
    connect({ buttons: {} });
    connect({ buttons: { 0: true } });
    expect(space).toEqual([false, true]);
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

  it("sums its direction whatever the direction input's oppositeKeys says", () => {
    const keyboard = new KeyboardInput();
    keyboard.start();
    const brake = new DirectionInput(keyboard, 'wasd', { oppositeKeys: { upDown: 'down' } });
    brake.start();
    input.bindDirection(brake, { y: { negative: 'b6', positive: 'b7' } });
    // the brake trigger touched over the full throttle
    connect({ buttons: { 6: 0.25, 7: 1 } });
    expect(brake.direction).toEqual({ x: 0, y: 0.75 });
    // nor overrides the throttle key
    keyboard.emulateKeyDown('KeyW');
    connect({ buttons: { 6: 0.25 } });
    expect(brake.direction).toEqual({ x: 0, y: 0.75 });
    keyboard.emulateKeyUp('KeyW');
    brake.stop();
    keyboard.stop();
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
    pads.setAll([fakeGamepad({ buttons: { 0: true } }), fakeGamepad({ index: 1, buttons: { 1: true } })]);
    indexed.poll();
    expect(indexed.value('b0')).toBe(0);
    expect(indexed.value('b1')).toBe(1);
    indexed.stop();
  });

  describe('choosing the gamepad', () => {
    const keyboardPad = fakeGamepad({ id: 'Keyboard (Vendor: 1234 Product: 0001)', index: 0, mapping: '' });
    const padA = fakeGamepad({ id: 'Pad (STANDARD GAMEPAD)', index: 1, buttons: { 0: true } });
    const padB = fakeGamepad({ id: 'Pad (STANDARD GAMEPAD)', index: 2, buttons: { 1: true } });

    it('reads the first gamepad with the standard mapping when nothing is chosen', () => {
      pads.setAll([keyboardPad, padA]);
      input.poll();
      expect(input.gamepad).toBe(padA);
      pads.setAll([keyboardPad]);
      expect(GamepadInput.selectedGamepad()).toBe(keyboardPad);
    });

    it('keeps reading the gamepad in use when another is listed later, until it is gone', () => {
      const wheel = fakeGamepad({ id: 'Wheel', index: 0, mapping: '', buttons: { 0: true } });
      pads.setAll([wheel]);
      input.poll();
      expect(input.gamepad).toBe(wheel);
      // a standard pad pressed mid-game: the wheel is the one in use
      pads.setAll([wheel, padA]);
      input.poll();
      expect(input.gamepad).toBe(wheel);
      expect(GamepadInput.selectedGamepad()).toBe(wheel);
      pads.setAll([null, padA]);
      input.poll();
      expect(input.gamepad).toBe(padA);
      // the wheel back: the pad is in use now
      pads.setAll([wheel, padA]);
      input.poll();
      expect(input.gamepad).toBe(padA);
      // a new choice starts over, from the wheel's held button
      GamepadInput.choice = null;
      input.poll();
      expect(input.gamepad).toBe(wheel);
      pads.setAll([wheel]);
      input.poll();
      pads.setAll([wheel, padA]);
      input.poll();
      expect(input.gamepad).toBe(wheel);
    });

    it('lets a gamepad listed later take over from one merely listed first, never pushed', () => {
      pads.setAll([keyboardPad, padA]);
      input.poll();
      expect(input.gamepad).toBe(padA);
      pads.setAll([keyboardPad]);
      input.poll();
      expect(input.gamepad).toBe(keyboardPad);
      pads.setAll([keyboardPad, padA]);
      input.poll();
      expect(input.gamepad).toBe(padA);
    });

    it('reads a pad pressed while an idle one is listed first, and keeps it', () => {
      const idle = fakeGamepad({ id: 'Pad (STANDARD GAMEPAD)', index: 0 });
      const pressed = fakeGamepad({ id: 'Pad (STANDARD GAMEPAD)', index: 1, buttons: { 0: true } });
      pads.setAll([idle, pressed]);
      input.poll();
      expect(input.gamepad).toBe(pressed);
      const released = fakeGamepad({ id: 'Pad (STANDARD GAMEPAD)', index: 1 });
      pads.setAll([idle, released]);
      input.poll();
      expect(input.gamepad).toBe(released);
    });

    it('does not hold on to pedals listed first that merely rest pushed', () => {
      const pedals = fakeGamepad({ id: 'Pedals', index: 0, mapping: '', axes: [-1, -1, -1] });
      pads.setAll([pedals]);
      input.poll();
      input.poll();
      expect(input.gamepad).toBe(pedals);
      pads.setAll([pedals, padA]);
      input.poll();
      expect(input.gamepad).toBe(padA);
    });

    it('reads the chosen one by id and nth, falling back while it is not connected', () => {
      pads.setAll([keyboardPad, padA, padB]);
      GamepadInput.choice = { id: padB.id, nth: 1 };
      input.poll();
      expect(input.value('b1')).toBe(1);

      pads.setAll([keyboardPad, null, padB]);
      // one of two of the same model left: that one
      input.poll();
      expect(input.gamepad).toBe(padB);
      GamepadInput.choice = { id: 'Wheel', nth: 0 };
      input.poll();
      expect(input.gamepad).toBe(padB);
      expect(input.gamepad).toBe(GamepadInput.selectedGamepad());
    });

    it('leaves an input with a gamepadIndex of its own alone', () => {
      const indexed = new GamepadInput({ gamepadIndex: 0 });
      indexed.start();
      pads.setAll([keyboardPad, padA]);
      GamepadInput.choice = GamepadInput.choiceOf(padA);
      indexed.poll();
      expect(indexed.gamepad).toBe(keyboardPad);
      indexed.stop();
    });

    it('steps through the connected gamepads with chooseNext, reporting choice$', () => {
      const choices: any[] = [];
      GamepadInput.choice$.subscribe(c => choices.push(c));
      pads.setAll([keyboardPad, padA, padB]);
      expect(GamepadInput.chooseNext()).toBe(padB);
      expect(GamepadInput.chooseNext()).toBe(keyboardPad);
      expect(GamepadInput.chooseNext(-1)).toBe(padB);
      expect(choices).toEqual([null, { id: padB.id, nth: 1 }, { id: keyboardPad.id, nth: 0 }, { id: padB.id, nth: 1 }]);
      pads.setAll([]);
      expect(GamepadInput.chooseNext()).toBeNull();
    });

    it('names a gamepad without what the browser adds to its id', () => {
      const named = (id: string) => GamepadInput.gamepadName(fakeGamepad({ id }));
      expect(named('Xbox 360 Controller (XInput STANDARD GAMEPAD)')).toBe('Xbox 360 Controller');
      expect(named('USB Gamepad (Vendor: 0079 Product: 0011)')).toBe('USB Gamepad');
      expect(named('Pad (STANDARD GAMEPAD Vendor: 046d Product: c21d)')).toBe('Pad');
      expect(named('45e-28e-Xbox 360 Wired Controller')).toBe('Xbox 360 Wired Controller');
      expect(named('(STANDARD GAMEPAD)')).toBe('(STANDARD GAMEPAD)');
      // parentheses of the product name itself stay
      expect(named('Logitech (R) Gamepad F310 (STANDARD GAMEPAD Vendor: 046d Product: c21d)')).toBe(
        'Logitech (R) Gamepad F310',
      );
      expect(named('8BitDo (Wired) Controller')).toBe('8BitDo (Wired) Controller');
    });

    it('keeps the gamepad in use over a menu reading the selection while it is disconnected for a moment', () => {
      const wheel = fakeGamepad({ id: 'Wheel', index: 0, mapping: '', buttons: { 0: true } });
      pads.setAll([wheel]);
      input.poll();
      pads.setAll([wheel, padA]);
      input.poll();
      expect(input.gamepad).toBe(wheel);
      // the wheel drops out between two polls while the menu refreshes its label
      pads.setAll([null, padA]);
      expect(GamepadInput.selectedGamepad()).toBe(padA);
      pads.setAll([wheel, padA]);
      input.poll();
      expect(input.gamepad).toBe(wheel);
      // gone at a poll: forgotten, the pad takes over
      pads.setAll([null, padA]);
      input.poll();
      pads.setAll([wheel, padA]);
      input.poll();
      expect(input.gamepad).toBe(padA);
    });

    it('lists no gamepad when the browser withholds them', () => {
      Object.defineProperty(navigator, 'getGamepads', {
        value: () => {
          throw new DOMException('not allowed', 'SecurityError');
        },
        configurable: true,
        writable: true,
      });
      expect(GamepadInput.connectedGamepads()).toEqual([]);
      expect(GamepadInput.chooseNext()).toBeNull();
    });

    it('does not report what is already held on a gamepad switched to as pushed', () => {
      const pushed: GamepadControl[] = [];
      input.controlPushed$.subscribe(c => pushed.push(c));
      pads.setAll([fakeGamepad({ id: 'Pad', index: 1 }), fakeGamepad({ id: 'Pad', index: 2, buttons: { 3: true } })]);
      GamepadInput.choice = { id: 'Pad', nth: 0 };
      input.poll();
      GamepadInput.choice = { id: 'Pad', nth: 1 };
      input.poll();
      expect(input.value('b3')).toBe(1);
      expect(pushed).toEqual([]);
      pads.setAll([
        fakeGamepad({ id: 'Pad', index: 1 }),
        fakeGamepad({ id: 'Pad', index: 2, buttons: { 3: true, 0: true } }),
      ]);
      input.poll();
      expect(pushed).toEqual(['b0']);
    });
  });

  it('reports the press that lists a gamepad as pushed, on the first one and on one connected again', () => {
    const pushed: GamepadControl[] = [];
    input.controlPushed$.subscribe(c => pushed.push(c));
    // the first gamepad: listed by the browser because of this very press
    connect({ buttons: { 0: true } });
    expect(pushed).toEqual(['b0']);
    pads.setAll([]);
    input.poll();
    expect(input.connected).toBe(false);
    // plugged back in: listed again because of this press, which a "press any button" menu waits for
    connect({ buttons: { 3: true } });
    expect(input.value('b3')).toBe(1);
    expect(pushed).toEqual(['b0', 'b3']);
    connect({ buttons: { 3: true, 1: true } });
    expect(pushed).toEqual(['b0', 'b3', 'b1']);
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

  it('is not in use by an axis returning to its rest', () => {
    connect({ axes: [0, 0, 0, 0, -1] });
    connect({ axes: [0, 0, 0, 0, 1] });
    expect(input.inUse).toBe(true);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
    connect({ axes: [0, 0, 0, 0, -1] });
    expect(input.inUse).toBe(false);
  });

  it('stays in use and connected while stopped, and gives it up only when the gamepad is gone', () => {
    const connected: boolean[] = [];
    input.connected$.subscribe(v => connected.push(v));
    connect({ buttons: { 0: true } });
    expect(input.inUse).toBe(true);
    input.stop();
    expect(input.inUse).toBe(true);
    // a menu shown while the world's input is off still names the gamepad's buttons
    expect(input.connected).toBe(true);
    expect(input.standardMapping).toBe(true);
    expect(input.value('b0')).toBe(0); // but every control reads as released
    input.start();
    connect({ buttons: { 0: true } });
    expect(connected).toEqual([false, true]); // no flicker over the stop
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

  describe('axes at rest', () => {
    const trigger = (v: number) => connect({ axes: [0, 0, 0, 0, 0, v] });
    let pushed: GamepadControl[];

    beforeEach(() => {
      pushed = [];
    });

    it('reports the pull of a trigger resting at -1, never its release', () => {
      input.controlPushed$.subscribe(c => pushed.push(c));
      trigger(-1);
      expect(pushed).toEqual([]);
      trigger(1);
      expect(pushed).toEqual(['a5+']);
      trigger(0);
      trigger(-1);
      expect(pushed).toEqual(['a5+']);
      trigger(1);
      trigger(-1); // let go within one poll
      trigger(1);
      expect(pushed).toEqual(['a5+', 'a5+', 'a5+']);
    });

    it('does not report the release of a trigger already held when the capture starts', () => {
      trigger(-1);
      trigger(1);
      input.controlPushed$.subscribe(c => pushed.push(c));
      trigger(-1);
      expect(pushed).toEqual([]);
      trigger(1);
      expect(pushed).toEqual(['a5+']);
    });

    it('keeps the rest of a trigger over a stop, and reports nothing held through a restart', () => {
      trigger(-1);
      trigger(1);
      input.stop();
      input.start();
      const other = new GamepadInput();
      other.start();
      input.controlPushed$.subscribe(c => pushed.push(c));
      other.controlPushed$.subscribe(c => pushed.push(c));
      // held through the restart, and when the other input started: not pushed now
      connect({ buttons: { 0: true }, axes: [0, 0, 0, 0, 0, 1] });
      other.poll();
      expect(pushed).toEqual([]);
      trigger(-1);
      other.poll();
      expect(pushed).toEqual([]);
      trigger(1);
      other.poll();
      expect(pushed).toEqual(['a5+', 'a5+']);
      other.stop();
    });

    it('takes an axis resting past half way as resting at that end', () => {
      input.controlPushed$.subscribe(c => pushed.push(c));
      trigger(-0.85); // a worn trigger
      trigger(1);
      trigger(-0.85);
      expect(pushed).toEqual(['a5+']);
    });

    it('takes a standard stick held when its gamepad is listed as resting at 0', () => {
      input.controlPushed$.subscribe(c => pushed.push(c));
      connect({ axes: [-1] }); // the push that made the browser list it
      connect({ axes: [0] });
      connect({ axes: [-1] });
      expect(pushed).toEqual(['a0-', 'a0-']);
    });

    it('learns the rest of a gamepad again when it is plugged in again', () => {
      input.controlPushed$.subscribe(c => pushed.push(c));
      trigger(1); // held when listed: taken as resting pulled
      trigger(-1);
      expect(pushed).toEqual(['a5-']);
      pads.set(null);
      input.poll();
      trigger(-1);
      trigger(1);
      expect(pushed).toEqual(['a5-', 'a5+']);
    });

    it('learns the rest of a gamepad listed while another one is read', () => {
      input.controlPushed$.subscribe(c => pushed.push(c));
      const both = (wheelTrigger: number) =>
        pads.setAll([
          fakeGamepad({ id: 'Pad' }),
          fakeGamepad({ id: 'Wheel', index: 1, mapping: '', axes: [0, 0, 0, 0, 0, wheelTrigger] }),
        ]);
      GamepadInput.choice = { id: 'Pad', nth: 0 };
      both(-1);
      input.poll();
      both(1); // the gas held by the time the wheel is chosen
      input.poll();
      GamepadInput.choice = { id: 'Wheel', nth: 0 };
      input.poll();
      both(-1);
      input.poll();
      both(1);
      input.poll();
      expect(pushed).toEqual(['a5+']);
    });

    it('does not report a trigger at rest on the first read after a start', () => {
      trigger(-1);
      input.stop();
      input.start();
      input.controlPushed$.subscribe(c => pushed.push(c));
      trigger(-1);
      expect(pushed).toEqual([]);
    });

    it('reports both directions of a shared axis resting at 0', () => {
      input.controlPushed$.subscribe(c => pushed.push(c));
      connect({ axes: [0, 0, 0] });
      connect({ axes: [0, 0, 1] }); // LT
      connect({ axes: [0, 0, 0] });
      connect({ axes: [0, 0, -1] }); // RT
      connect({ axes: [0, 0, 1] }); // RT let go and LT pulled within one poll
      expect(pushed).toEqual(['a2+', 'a2-', 'a2+']);
    });

    it("reports a stick's left then right in one capture", () => {
      input.controlPushed$.subscribe(c => pushed.push(c));
      connect();
      connect({ axes: [-1] });
      connect({ axes: [0] });
      connect({ axes: [1] });
      connect({ axes: [-1] }); // flicked across within one poll
      expect(pushed).toEqual(['a0-', 'a0+', 'a0-']);
    });

    it('learns the rest of each gamepad on its own', () => {
      input.controlPushed$.subscribe(c => pushed.push(c));
      pads.setAll([
        fakeGamepad({ id: 'Pad', axes: [0, 0, 0, 0, 0, -1] }),
        fakeGamepad({ id: 'Stick', index: 1, axes: [0, 0, 0, 0, 0, 0] }),
      ]);
      GamepadInput.choice = { id: 'Pad', nth: 0 };
      input.poll();
      GamepadInput.choice = { id: 'Stick', nth: 0 };
      input.poll();
      pads.setAll([
        fakeGamepad({ id: 'Pad', axes: [0, 0, 0, 0, 0, -1] }),
        fakeGamepad({ id: 'Stick', index: 1, axes: [0, 0, 0, 0, 0, -1] }),
      ]);
      input.poll();
      expect(pushed).toEqual(['a5-']);
    });
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

  it('reads navigator.getGamepads() once per frame for every running input', () => {
    const other = new GamepadInput();
    other.start();
    const getGamepads = jest.spyOn(navigator, 'getGamepads');
    pads.set({ buttons: { 0: true } });
    (GgGlobalClock.instance as any)._tick$.next([0, 16]);
    expect(getGamepads).toHaveBeenCalledTimes(1);
    expect(input.pressed('b0')).toBe(true);
    expect(other.pressed('b0')).toBe(true);
    other.stop();
    (GgGlobalClock.instance as any)._tick$.next([16, 16]);
    expect(getGamepads).toHaveBeenCalledTimes(2);
    expect(other.pressed('b0')).toBe(false);
    input.stop();
    (GgGlobalClock.instance as any)._tick$.next([32, 16]);
    expect(getGamepads).toHaveBeenCalledTimes(2);
    getGamepads.mockRestore();
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
