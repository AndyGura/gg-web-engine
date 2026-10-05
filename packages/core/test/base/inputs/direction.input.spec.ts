import { DirectionInput, KeyboardInput, MouseInput, Point2 } from '../../../src';

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
