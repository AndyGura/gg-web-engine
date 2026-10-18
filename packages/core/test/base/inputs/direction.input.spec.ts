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

  it('leaves output$ to the keys alone', () => {
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

  it('ignores analog contributions while stopped and drops them on stop', () => {
    input.setAnalogDirection('stick', { x: 1 });
    input.stop();
    expect(input.direction).toEqual({ x: 0, y: 0 });
    input.setAnalogDirection('stick', { x: 1 });
    expect(input.direction).toEqual({ x: 0, y: 0 });
    input.start();
    expect(input.direction).toEqual({ x: 0, y: 0 });
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

      input.keymap = { up: 'KeyI', down: 'KeyK', left: 'KeyJ', right: 'KeyL' };
      expect(input.keymap).toEqual({ up: 'KeyI', down: 'KeyK', left: 'KeyJ', right: 'KeyL' });
      // the old key let go of, though still held
      expect(input.direction).toEqual({ x: 0, y: 0 });
      expect(outputs[outputs.length - 1]).toEqual({});
      keyboard.emulateKeyUp('KeyW');
      keyboard.emulateKeyDown('KeyW');
      expect(input.direction).toEqual({ x: 0, y: 0 });
      keyboard.emulateKeyDown('KeyL');
      expect(input.direction).toEqual({ x: 1, y: 0 });
      expect(outputs[outputs.length - 1]).toEqual({ leftRight: false });

      input.keymap = null;
      expect(input.direction).toEqual({ x: 0, y: 0 });
      keyboard.emulateKeyUp('KeyL');
      keyboard.emulateKeyDown('KeyL');
      expect(input.direction).toEqual({ x: 0, y: 0 });
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
      expect((keyboard as any).bindings['ArrowLeft']).toEqual([]);
      expect((keyboard as any).bindings['KeyW']).toEqual([]);
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
