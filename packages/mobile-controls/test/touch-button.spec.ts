import { DirectionInput, KeyboardInput } from '@gg-web-engine/core';
import { TouchButton } from '../src';
import { pointer } from './helpers';

describe('TouchButton', () => {
  let keyboard: KeyboardInput;

  beforeEach(() => {
    keyboard = new KeyboardInput();
    keyboard.start();
  });

  afterEach(() => keyboard.stop());

  it('is pressed while a pointer is down on it', () => {
    const button = new TouchButton();
    const values: boolean[] = [];
    button.pressed$.subscribe(v => values.push(v));

    pointer(button.element, 'pointerdown');
    expect(button.element.classList.contains('gg-mc-active')).toBe(true);
    pointer(button.element, 'pointerup');

    expect(values).toEqual([false, true, false]);
    expect(button.element.classList.contains('gg-mc-active')).toBe(false);
  });

  it('follows only the pointer that pressed it', () => {
    const button = new TouchButton();
    pointer(button.element, 'pointerdown', 0, 0, 1);
    pointer(button.element, 'pointerdown', 0, 0, 2);
    pointer(button.element, 'pointerup', 0, 0, 2);
    expect(button.pressed).toBe(true);
    pointer(button.element, 'pointerup', 0, 0, 1);
    expect(button.pressed).toBe(false);
  });

  it('keeps the pointer from the elements below it', () => {
    const button = new TouchButton();
    document.body.appendChild(button.element);
    const seen = jest.fn();
    window.addEventListener('pointerdown', seen);
    window.addEventListener('pointermove', seen);

    pointer(button.element, 'pointerdown');
    pointer(button.element, 'pointermove', 5, 5);

    expect(seen).not.toHaveBeenCalled();
    window.removeEventListener('pointerdown', seen);
    window.removeEventListener('pointermove', seen);
    button.dispose();
  });

  it('flips on every press in toggle mode, and is released by reset', () => {
    const button = new TouchButton({ mode: 'toggle' });
    pointer(button.element, 'pointerdown');
    pointer(button.element, 'pointerup');
    expect(button.pressed).toBe(true);
    pointer(button.element, 'pointerdown');
    pointer(button.element, 'pointerup');
    expect(button.pressed).toBe(false);

    pointer(button.element, 'pointerdown');
    pointer(button.element, 'pointerup');
    button.reset();
    expect(button.pressed).toBe(false);
  });

  it('acts as a bound key', () => {
    const values: boolean[] = [];
    keyboard.bind('Space').subscribe(v => values.push(v));
    const button = new TouchButton().bindKey(keyboard, 'Space');

    pointer(button.element, 'pointerdown');
    pointer(button.element, 'pointerup');

    expect(values).toEqual([false, true, false]);
  });

  it('releases a bound key when disposed while pressed', () => {
    const values: boolean[] = [];
    keyboard.bind('Space').subscribe(v => values.push(v));
    const button = new TouchButton().bindKey(keyboard, 'Space');

    pointer(button.element, 'pointerdown');
    button.dispose();

    expect(values).toEqual([false, true, false]);
  });

  it('pushes a bound direction input while pressed', () => {
    const input = new DirectionInput(keyboard, 'arrows');
    input.start();
    const button = new TouchButton().bindDirection(input, { x: -1 });

    pointer(button.element, 'pointerdown');
    expect(input.direction).toEqual({ x: -1, y: 0 });
    pointer(button.element, 'pointerup');
    expect(input.direction).toEqual({ x: 0, y: 0 });
    input.stop();
  });

  it('calls onPress/onRelease, and carries its id and content', () => {
    const press = jest.fn();
    const release = jest.fn();
    const button = new TouchButton({ id: 'fire', content: 'A', label: 'Fire' }).onPress(press).onRelease(release);
    expect(button.element.classList.contains('gg-mc-id-fire')).toBe(true);
    expect(button.element.textContent).toBe('A');
    expect(button.element.getAttribute('aria-label')).toBe('Fire');

    pointer(button.element, 'pointerdown');
    expect(press).toHaveBeenCalledTimes(1);
    expect(release).not.toHaveBeenCalled();
    pointer(button.element, 'pointerup');
    expect(release).toHaveBeenCalledTimes(1);
  });
});
