import { DirectionInput, KeyboardInput, MouseInput, Point2 } from '@gg-web-engine/core';
import { TouchDPad, TouchLookArea, TouchStick } from '../src';
import { pointer, setRect } from './helpers';

describe('TouchStick', () => {
  const fixedStick = (options: any = {}) => {
    const stick = new TouchStick({ travel: 50, deadzone: 0, ...options });
    // base centered at (100, 100)
    setRect(stick.element.firstElementChild!, 50, 50, 100, 100);
    return stick;
  };

  it('reports the deflection from its center, y up, capped at 1', () => {
    const stick = fixedStick();
    pointer(stick.element, 'pointerdown', 125, 100);
    expect(stick.value).toEqual({ x: 0.5, y: 0 });
    pointer(stick.element, 'pointermove', 100, 50);
    expect(stick.value).toEqual({ x: 0, y: 1 });
    pointer(stick.element, 'pointermove', 400, 100);
    expect(stick.value).toEqual({ x: 1, y: 0 });
    pointer(stick.element, 'pointerup');
    expect(stick.value).toEqual({ x: 0, y: 0 });
  });

  it('reads zero inside the deadzone and grows from zero outside of it', () => {
    const stick = fixedStick({ deadzone: 0.2 });
    pointer(stick.element, 'pointerdown', 105, 100);
    expect(stick.value).toEqual({ x: 0, y: 0 });
    pointer(stick.element, 'pointermove', 130, 100);
    expect(stick.value.x).toBeCloseTo(0.5);
    pointer(stick.element, 'pointermove', 150, 100);
    expect(stick.value.x).toBeCloseTo(1);
  });

  it('moves along one axis only when restricted', () => {
    const stick = fixedStick({ axes: 'x' });
    pointer(stick.element, 'pointerdown', 125, 20);
    expect(stick.value).toEqual({ x: 0.5, y: 0 });
  });

  it('centers under the finger in floating mode', () => {
    const stick = new TouchStick({ mode: 'floating', travel: 50, deadzone: 0 });
    setRect(stick.element, 0, 0, 400, 300);
    pointer(stick.element, 'pointerdown', 200, 150);
    expect(stick.value).toEqual({ x: 0, y: 0 });
    pointer(stick.element, 'pointermove', 200, 175);
    expect(stick.value).toEqual({ x: 0, y: -0.5 });
  });

  it('feeds a bound direction input and withdraws when released', () => {
    const keyboard = new KeyboardInput();
    keyboard.start();
    const input = new DirectionInput(keyboard, 'wasd');
    input.start();
    const stick = fixedStick().bindDirection(input);

    pointer(stick.element, 'pointerdown', 125, 75);
    expect(input.direction).toEqual({ x: 0.5, y: 0.5 });
    keyboard.emulateKeyDown('KeyD');
    expect(input.direction).toEqual({ x: 1, y: 0.5 });
    keyboard.emulateKeyUp('KeyD');
    stick.dispose();
    expect(input.direction).toEqual({ x: 0, y: 0 });
    input.stop();
    keyboard.stop();
  });

  it('holds bound keys past the threshold', () => {
    const keyboard = new KeyboardInput();
    keyboard.start();
    const up: boolean[] = [];
    const left: boolean[] = [];
    keyboard.bind('KeyW').subscribe(v => up.push(v));
    keyboard.bind('KeyA').subscribe(v => left.push(v));
    const stick = fixedStick().bindKeys(keyboard, { up: 'KeyW', left: 'KeyA' });

    pointer(stick.element, 'pointerdown', 100, 60);
    pointer(stick.element, 'pointermove', 60, 100);
    pointer(stick.element, 'pointerup');

    expect(up).toEqual([false, true, false]);
    expect(left).toEqual([false, true, false]);
    keyboard.stop();
  });
});

describe('TouchDPad', () => {
  const dpad = (options: any = {}) => {
    const control = new TouchDPad(options);
    setRect(control.element, 0, 0, 100, 100);
    return control;
  };

  it('snaps to eight directions and lets a finger slide between them', () => {
    const control = dpad();
    pointer(control.element, 'pointerdown', 50, 10);
    expect(control.value).toEqual({ x: 0, y: 1 });
    expect(control.element.querySelector('.gg-mc-dpad-arm--up')!.classList.contains('gg-mc-active')).toBe(true);
    pointer(control.element, 'pointermove', 90, 10);
    expect(control.value).toEqual({ x: 1, y: 1 });
    pointer(control.element, 'pointermove', 90, 50);
    expect(control.value).toEqual({ x: 1, y: 0 });
    pointer(control.element, 'pointermove', 50, 52);
    expect(control.value).toEqual({ x: 0, y: 0 });
    pointer(control.element, 'pointerup');
    expect(control.element.querySelector('.gg-mc-active')).toBeNull();
  });

  it('snaps to four directions without diagonals', () => {
    const control = dpad({ diagonals: false });
    pointer(control.element, 'pointerdown', 90, 20);
    expect(Math.abs(control.value.x) + Math.abs(control.value.y)).toBe(1);
  });
});

describe('TouchLookArea', () => {
  it('reports drags through a bound mouse input, scaled', () => {
    const mouse = new MouseInput();
    mouse.start();
    const deltas: Point2[] = [];
    mouse.delta$.subscribe(d => deltas.push(d));
    const area = new TouchLookArea().bindMouse(mouse, 2);

    pointer(area.element, 'pointerdown', 10, 10);
    pointer(area.element, 'pointermove', 15, 7);
    pointer(area.element, 'pointermove', 15, 17);
    pointer(area.element, 'pointerup', 15, 17);

    expect(deltas).toEqual([
      { x: 10, y: -6 },
      { x: 0, y: 20 },
    ]);
    mouse.stop();
  });

  it('reports a short still touch as a tap, a drag not', () => {
    const area = new TouchLookArea();
    const taps: Point2[] = [];
    area.tap$.subscribe(p => taps.push(p));

    pointer(area.element, 'pointerdown', 10, 10);
    pointer(area.element, 'pointerup', 11, 10);
    pointer(area.element, 'pointerdown', 10, 10);
    pointer(area.element, 'pointermove', 60, 10);
    pointer(area.element, 'pointerup', 60, 10);

    expect(taps).toEqual([{ x: 11, y: 10 }]);
  });
});
