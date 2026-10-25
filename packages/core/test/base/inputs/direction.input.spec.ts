import { DirectionInput, directionKeyCodes, KeyboardInput, MouseInput, Point2 } from '../../../src';

describe('DirectionInput', () => {
  let keyboard: KeyboardInput;
  let input: DirectionInput;

  beforeEach(() => {
    keyboard = new KeyboardInput();
    keyboard.start();
    input = new DirectionInput(keyboard, 'wasd');
    input.start();
  });

  afterEach(() => {
    input.stop();
    keyboard.stop();
  });

  it('reports held keys through direction$ as a vector, x to the right and y forward', () => {
    const values: Point2[] = [];
    input.direction$.subscribe(v => values.push(v));

    keyboard.emulateKeyDown('KeyW');
    keyboard.emulateKeyDown('KeyA');
    keyboard.emulateKeyUp('KeyW');
    keyboard.emulateKeyUp('KeyA');

    expect(values).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: -1, y: 1 },
      { x: -1, y: 0 },
      { x: 0, y: 0 },
    ]);
  });

  it('sums analog contributions with the keys, clamping each axis', () => {
    const stick = {};
    const tilt = {};
    input.setAnalogDirection(stick, { x: 0.4, y: -0.25 });
    expect(input.direction).toEqual({ x: 0.4, y: -0.25 });

    input.setAnalogDirection(tilt, { x: 0.3 });
    expect(input.direction.x).toBeCloseTo(0.7);
    expect(input.direction.y).toBe(-0.25);

    keyboard.emulateKeyDown('KeyD');
    expect(input.direction).toEqual({ x: 1, y: -0.25 });
    keyboard.emulateKeyUp('KeyD');

    input.setAnalogDirection(stick, { x: -0.5 });
    expect(input.direction.x).toBeCloseTo(-0.2);
    input.setAnalogDirection(stick, null);
    input.setAnalogDirection(tilt, null);
    expect(input.direction).toEqual({ x: 0, y: 0 });
  });

  it('leaves analog contributions out of output$', () => {
    const outputs: any[] = [];
    input.output$.subscribe(o => outputs.push(o));
    input.setAnalogDirection({}, { x: 1 });
    expect(outputs).toEqual([]);
  });

  it('takes analog contributions alone when created without a keyboard', () => {
    const analog = new DirectionInput();
    analog.start();
    analog.setAnalogDirection('stick', { x: 0.5, y: 1 });
    expect(analog.direction).toEqual({ x: 0.5, y: 1 });
    analog.stop();
    expect(analog.direction).toEqual({ x: 0, y: 0 });
  });

  it('goes straight to zero on stop, with keys and contributions held', () => {
    const values: Point2[] = [];
    input.direction$.subscribe(v => values.push(v));
    keyboard.emulateKeyDown('KeyW');
    input.setAnalogDirection('stick', { y: 0.5 });
    expect(values).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: 1 },
    ]);
    input.stop();
    expect(values).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: 0 },
    ]);
  });

  it('ignores analog contributions while stopped and drops them on stop', () => {
    input.setAnalogDirection('stick', { x: 1 });
    input.stop();
    expect(input.direction).toEqual({ x: 0, y: 0 });
    input.setAnalogDirection('stick', { x: 1 });
    expect(input.direction).toEqual({ x: 0, y: 0 });
    input.start();
    expect(input.direction).toEqual({ x: 0, y: 0 });
  });

  describe('pressed directions', () => {
    it('count as held keys, in direction$ and output$', () => {
      const outputs: any[] = [];
      input.output$.subscribe(o => outputs.push(o));
      input.pressDirection('up', 'button');
      expect(input.direction).toEqual({ x: 0, y: 1 });
      input.pressDirection('left', 'other');
      expect(input.direction).toEqual({ x: -1, y: 1 });
      input.releaseDirection('up', 'button');
      input.releaseDirection('left', 'other');
      expect(input.direction).toEqual({ x: 0, y: 0 });
      expect(outputs).toEqual([{ upDown: true }, { upDown: true, leftRight: true }, { leftRight: true }, {}]);
    });

    it('stay held while any holder or key holds them', () => {
      input.pressDirection('right', 'a');
      input.pressDirection('right', 'a');
      input.pressDirection('right', 'b');
      keyboard.emulateKeyDown('KeyD');
      input.releaseDirection('right', 'a');
      expect(input.direction).toEqual({ x: 1, y: 0 });
      keyboard.emulateKeyUp('KeyD');
      expect(input.direction).toEqual({ x: 1, y: 0 });
      input.releaseDirection('right', 'b');
      expect(input.direction).toEqual({ x: 0, y: 0 });
      // releasing what is not held changes nothing
      input.releaseDirection('right', 'b');
      expect(input.direction).toEqual({ x: 0, y: 0 });
    });

    it('are decided by oppositeKeys together with the keys, while analog contributions are summed', () => {
      const brake = new DirectionInput(keyboard, 'wasd', { oppositeKeys: { upDown: 'down' } });
      brake.start();
      // two buttons
      brake.pressDirection('up', 'throttle');
      brake.pressDirection('down', 'brake');
      expect(brake.direction).toEqual({ x: 0, y: -1 });
      brake.releaseDirection('down', 'brake');
      expect(brake.direction).toEqual({ x: 0, y: 1 });
      // a button and a key
      keyboard.emulateKeyDown('KeyS');
      expect(brake.direction).toEqual({ x: 0, y: -1 });
      keyboard.emulateKeyUp('KeyS');
      // an analog contribution summed on top
      brake.pressDirection('down', 'brake');
      brake.setAnalogDirection('stick', { y: 0.5 });
      expect(brake.direction).toEqual({ x: 0, y: -0.5 });
      // an axis left out cancels
      brake.pressDirection('left', 'left');
      brake.pressDirection('right', 'right');
      expect(brake.direction.x).toBe(0);
      // a new setting applies at once
      brake.oppositeKeys = { upDown: 'up', leftRight: 'right' };
      expect(brake.direction).toEqual({ x: 1, y: 1 });
      brake.stop();
    });

    it('work without a keyboard, and survive a rebind', () => {
      const keyless = new DirectionInput(null, null, { oppositeKeys: { upDown: 'down' } });
      keyless.start();
      keyless.pressDirection('up', 'throttle');
      keyless.pressDirection('down', 'brake');
      expect(keyless.direction).toEqual({ x: 0, y: -1 });
      keyless.stop();

      input.pressDirection('left', 'button');
      input.keymap = 'arrows';
      expect(input.direction).toEqual({ x: -1, y: 0 });
      keyboard.emulateKeyDown('ArrowUp');
      expect(input.direction).toEqual({ x: -1, y: 1 });
      keyboard.emulateKeyUp('ArrowUp');
      input.keymap = null;
      expect(input.direction).toEqual({ x: -1, y: 0 });
    });

    it('are ignored while stopped and released on stop', () => {
      const outputs: any[] = [];
      const keyless = new DirectionInput();
      keyless.output$.subscribe(o => outputs.push(o));
      keyless.pressDirection('up', 'button');
      expect(keyless.direction).toEqual({ x: 0, y: 0 });
      keyless.start();
      keyless.pressDirection('up', 'button');
      keyless.stop();
      expect(keyless.direction).toEqual({ x: 0, y: 0 });
      expect(outputs).toEqual([{ upDown: true }, {}]);
      keyless.start();
      expect(keyless.direction).toEqual({ x: 0, y: 0 });
      keyless.stop();
    });
  });

  describe('custom key codes', () => {
    it('reads the codes given per direction, a single code or a list', () => {
      const custom = new DirectionInput(keyboard, {
        up: ['KeyI', 'Numpad8'],
        down: 'KeyK',
        left: 'KeyJ',
        right: 'KeyL',
      });
      custom.start();

      keyboard.emulateKeyDown('Numpad8');
      keyboard.emulateKeyDown('KeyJ');
      expect(custom.direction).toEqual({ x: -1, y: 1 });
      keyboard.emulateKeyDown('KeyL');
      expect(custom.direction).toEqual({ x: 0, y: 1 });
      keyboard.emulateKeyUp('Numpad8');
      keyboard.emulateKeyUp('KeyJ');
      keyboard.emulateKeyDown('KeyK');
      expect(custom.direction).toEqual({ x: 1, y: -1 });
      // keys of the built-in layouts are not read
      keyboard.emulateKeyUp('KeyK');
      keyboard.emulateKeyUp('KeyL');
      keyboard.emulateKeyDown('KeyW');
      expect(custom.direction).toEqual({ x: 0, y: 0 });
      custom.stop();
    });

    it('works with a direction left without codes', () => {
      const custom = new DirectionInput(keyboard, { up: [], down: [], left: 'KeyQ', right: 'KeyE' });
      custom.start();
      keyboard.emulateKeyDown('KeyE');
      expect(custom.direction).toEqual({ x: 1, y: 0 });
      custom.stop();
    });

    it('rebinds at once when keymap is assigned while running', () => {
      const outputs: any[] = [];
      input.output$.subscribe(o => outputs.push(o));
      keyboard.emulateKeyDown('KeyW');
      expect(input.direction).toEqual({ x: 0, y: 1 });

      const before = outputs.length;
      input.keymap = { up: 'KeyI', down: 'KeyK', left: 'KeyJ', right: 'KeyL' };
      expect(input.keymap).toEqual({ up: 'KeyI', down: 'KeyK', left: 'KeyJ', right: 'KeyL' });
      // the old key let go of, though still held: reported once
      expect(input.direction).toEqual({ x: 0, y: 0 });
      expect(outputs.slice(before)).toEqual([{}]);
      keyboard.emulateKeyUp('KeyW');
      keyboard.emulateKeyDown('KeyW');
      expect(input.direction).toEqual({ x: 0, y: 0 });
      keyboard.emulateKeyDown('KeyL');
      expect(input.direction).toEqual({ x: 1, y: 0 });
      expect(outputs[outputs.length - 1]).toEqual({ leftRight: false });

      const beforeNull = outputs.length;
      input.keymap = null;
      expect(input.direction).toEqual({ x: 0, y: 0 });
      expect(outputs.slice(beforeNull)).toEqual([{}]);
      // nothing was bound: nothing to report
      input.keymap = null;
      expect(outputs.length).toBe(beforeNull + 1);
      keyboard.emulateKeyUp('KeyL');
      keyboard.emulateKeyDown('KeyL');
      expect(input.direction).toEqual({ x: 0, y: 0 });
    });

    it('leaves a held key alone when the keymap assigned stands for the same codes', () => {
      const outputs: any[] = [];
      input.output$.subscribe(o => outputs.push(o));
      keyboard.emulateKeyDown('KeyW');
      expect(input.direction).toEqual({ x: 0, y: 1 });
      const before = outputs.length;
      input.keymap = 'wasd';
      input.keymap = { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD' };
      expect(input.direction).toEqual({ x: 0, y: 1 });
      expect(outputs.length).toBe(before);
      expect(input.keymap).toEqual({ up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD' });
      // the same codes in another order
      input.keymap = 'wasd+arrows';
      keyboard.emulateKeyDown('ArrowUp');
      const afterBoth = outputs.length;
      input.keymap = {
        up: ['ArrowUp', 'KeyW'],
        down: ['ArrowDown', 'KeyS'],
        left: ['ArrowLeft', 'KeyA'],
        right: ['ArrowRight', 'KeyD'],
      };
      expect(input.direction).toEqual({ x: 0, y: 1 });
      expect(outputs.length).toBe(afterBoth);
    });

    it('keeps analog contributions across a rebind', () => {
      input.setAnalogDirection('stick', { x: 0.5 });
      input.keymap = 'arrows';
      expect(input.direction).toEqual({ x: 0.5, y: 0 });
      keyboard.emulateKeyDown('ArrowUp');
      expect(input.direction).toEqual({ x: 0.5, y: 1 });
    });

    it('takes a keymap assigned while stopped on the next start, and leaves no old binding behind', () => {
      input.stop();
      input.keymap = 'arrows';
      input.start();
      keyboard.emulateKeyDown('KeyW');
      expect(input.direction).toEqual({ x: 0, y: 0 });
      keyboard.emulateKeyDown('ArrowLeft');
      expect(input.direction).toEqual({ x: -1, y: 0 });
      input.stop();
      expect((keyboard as any).bindings.get('ArrowLeft')).toEqual([]);
      expect((keyboard as any).bindings.get('KeyW')).toEqual([]);
    });
  });

  describe('both opposite keys held', () => {
    const holdBoth = (keyboard: KeyboardInput, first: string, second: string) => {
      keyboard.emulateKeyDown(first);
      keyboard.emulateKeyDown(second);
    };

    it('cancel each other out by default', () => {
      const outputs: any[] = [];
      input.output$.subscribe(o => outputs.push(o));
      holdBoth(keyboard, 'KeyW', 'KeyS');
      holdBoth(keyboard, 'KeyA', 'KeyD');
      expect(input.oppositeKeys).toEqual({});
      expect(input.direction).toEqual({ x: 0, y: 0 });
      expect(outputs[outputs.length - 1]).toEqual({});
      keyboard.emulateKeyUp('KeyW');
      keyboard.emulateKeyUp('KeyD');
      expect(input.direction).toEqual({ x: -1, y: -1 });
      expect(outputs[outputs.length - 1]).toEqual({ upDown: false, leftRight: true });
    });

    it('cancel each other out with cancel given', () => {
      const cancel = new DirectionInput(keyboard, 'wasd', { oppositeKeys: { upDown: 'cancel', leftRight: 'cancel' } });
      cancel.start();
      holdBoth(keyboard, 'KeyW', 'KeyS');
      holdBoth(keyboard, 'KeyA', 'KeyD');
      expect(cancel.direction).toEqual({ x: 0, y: 0 });
      cancel.stop();
    });

    it.each([
      ['down', 'left', { x: -1, y: -1 }, { upDown: false, leftRight: true }],
      ['up', 'right', { x: 1, y: 1 }, { upDown: true, leftRight: false }],
    ] as const)('give the winner, %s and %s, in direction$ and output$', (upDown, leftRight, direction, output) => {
      const winner = new DirectionInput(keyboard, 'wasd', { oppositeKeys: { upDown, leftRight } });
      winner.start();
      const outputs: any[] = [];
      winner.output$.subscribe(o => outputs.push(o));
      // pressed in either order
      holdBoth(keyboard, 'KeyW', 'KeyS');
      holdBoth(keyboard, 'KeyD', 'KeyA');
      expect(winner.direction).toEqual(direction);
      expect(outputs[outputs.length - 1]).toEqual(output);
      winner.stop();
    });

    it('give the other key back when the winner is released, and the winner when the other is', () => {
      const brake = new DirectionInput(keyboard, 'wasd', { oppositeKeys: { upDown: 'down' } });
      brake.start();
      keyboard.emulateKeyDown('KeyW');
      expect(brake.direction).toEqual({ x: 0, y: 1 });
      keyboard.emulateKeyDown('KeyS');
      expect(brake.direction).toEqual({ x: 0, y: -1 });
      keyboard.emulateKeyUp('KeyS');
      expect(brake.direction).toEqual({ x: 0, y: 1 });
      keyboard.emulateKeyDown('KeyS');
      keyboard.emulateKeyUp('KeyW');
      expect(brake.direction).toEqual({ x: 0, y: -1 });
      keyboard.emulateKeyUp('KeyS');
      expect(brake.direction).toEqual({ x: 0, y: 0 });
      // an axis left out cancels
      holdBoth(keyboard, 'KeyA', 'KeyD');
      expect(brake.direction).toEqual({ x: 0, y: 0 });
      brake.stop();
    });

    it('applies at once to the keys held when assigned while running, and only to the keys', () => {
      const outputs: any[] = [];
      input.output$.subscribe(o => outputs.push(o));
      input.setAnalogDirection('stick', { x: 0.5 });
      holdBoth(keyboard, 'KeyW', 'KeyS');
      expect(input.direction).toEqual({ x: 0.5, y: 0 });

      const before = outputs.length;
      input.oppositeKeys = { upDown: 'down' };
      expect(input.oppositeKeys).toEqual({ upDown: 'down' });
      expect(input.direction).toEqual({ x: 0.5, y: -1 });
      expect(outputs.slice(before)).toEqual([{ upDown: false }]);
      // a setting giving the same result reports nothing
      input.oppositeKeys = { upDown: 'down', leftRight: 'right' };
      expect(outputs.length).toBe(before + 1);
      input.oppositeKeys = { upDown: 'up' };
      expect(input.direction).toEqual({ x: 0.5, y: 1 });
      input.oppositeKeys = {};
      expect(input.direction).toEqual({ x: 0.5, y: 0 });
      expect(outputs.slice(before)).toEqual([{ upDown: false }, { upDown: true }, {}]);
    });

    it('takes a setting assigned while stopped on the next start, and keeps it across a rebind', () => {
      input.stop();
      input.oppositeKeys = { leftRight: 'left' };
      input.start();
      holdBoth(keyboard, 'KeyA', 'KeyD');
      expect(input.direction).toEqual({ x: -1, y: 0 });
      input.keymap = 'arrows';
      holdBoth(keyboard, 'ArrowRight', 'ArrowLeft');
      expect(input.direction).toEqual({ x: -1, y: 0 });
    });
  });

  it('directionKeyCodes lists the codes of every keymap, as copies', () => {
    expect(directionKeyCodes('wasd+arrows')).toEqual({
      up: ['KeyW', 'ArrowUp'],
      down: ['KeyS', 'ArrowDown'],
      left: ['KeyA', 'ArrowLeft'],
      right: ['KeyD', 'ArrowRight'],
    });
    const up = ['KeyI'];
    const codes = directionKeyCodes({ up, down: 'KeyK', left: [], right: 'KeyL' });
    expect(codes).toEqual({ up: ['KeyI'], down: ['KeyK'], left: [], right: ['KeyL'] });
    expect(codes.up).not.toBe(up);
  });
});

describe('MouseInput.emulateMove', () => {
  it('emits through delta$ only while running', () => {
    const mouse = new MouseInput();
    const deltas: Point2[] = [];
    mouse.delta$.subscribe(d => deltas.push(d));

    mouse.emulateMove({ x: 1, y: 1 });
    mouse.start();
    mouse.emulateMove({ x: 3, y: -2 });
    mouse.stop();
    mouse.emulateMove({ x: 5, y: 5 });

    expect(deltas).toEqual([{ x: 3, y: -2 }]);
  });
});
