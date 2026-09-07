import { KeyboardInput } from '../../../src';

describe('KeyboardInput', () => {
  let keyboard: KeyboardInput;

  beforeEach(() => {
    keyboard = new KeyboardInput();
  });

  afterEach(() => {
    keyboard.stop();
  });

  const dispatch = (type: 'keydown' | 'keyup', code: string, target: EventTarget = window) => {
    const event = new KeyboardEvent(type, { code, bubbles: true, cancelable: true });
    target.dispatchEvent(event);
    return event;
  };

  it('reports true/false for a bound key on real keydown/keyup events, once started', () => {
    keyboard.start();
    const values: boolean[] = [];
    keyboard.bind('Space').subscribe(v => values.push(v));

    dispatch('keydown', 'Space');
    dispatch('keyup', 'Space');

    expect(values).toEqual([false, true, false]); // BehaviorSubject's initial value, then down, then up
  });

  it('does not react to key events at all before start() (or after stop())', () => {
    const values: boolean[] = [];
    keyboard.bind('Space').subscribe(v => values.push(v));

    dispatch('keydown', 'Space'); // never started - listeners aren't attached yet
    expect(values).toEqual([false]);

    keyboard.start();
    keyboard.stop();
    dispatch('keydown', 'Space'); // stopped again - listeners detached
    expect(values).toEqual([false]);
  });

  it('preventDefault()s a real event for a key that is currently bound (regression: nothing stopped a bound key like Space from also scrolling the page/activating a focused button)', () => {
    keyboard.start();
    keyboard.bind('Space').subscribe();

    const event = dispatch('keydown', 'Space');

    expect(event.defaultPrevented).toBe(true);
  });

  it('leaves an unbound key alone entirely - no preventDefault(), regardless of skipKeyDownsOnExternalFocus', () => {
    keyboard.start();
    keyboard.bind('Space').subscribe(); // bind something, but not the key we're about to press

    const event = dispatch('keydown', 'KeyQ');

    expect(event.defaultPrevented).toBe(false);
  });

  it('still drops a keydown while a blacklisted element (e.g. a focused button) has focus, even for a bound key', () => {
    keyboard.start();
    const values: boolean[] = [];
    keyboard.bind('Space').subscribe(v => values.push(v));

    const button = document.createElement('button');
    document.body.appendChild(button);
    button.focus();
    try {
      const event = dispatch('keydown', 'Space');
      expect(values).toEqual([false]); // keydown never reached the binding
      expect(event.defaultPrevented).toBe(false); // and was never even claimed via preventDefault()
    } finally {
      document.body.removeChild(button);
    }
  });
});
