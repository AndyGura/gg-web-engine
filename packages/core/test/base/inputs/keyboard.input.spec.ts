import { KeyboardInput } from '../../../src';

describe('KeyboardInput', () => {
  let keyboard: KeyboardInput;

  beforeEach(() => {
    keyboard = new KeyboardInput();
  });

  afterEach(() => {
    keyboard.stop();
  });

  const dispatch = (
    type: 'keydown' | 'keyup',
    code: string,
    target: EventTarget = window,
    init: KeyboardEventInit = {},
  ) => {
    const event = new KeyboardEvent(type, { code, bubbles: true, cancelable: true, ...init });
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

  it('keeps a key held through emulateKeyDown down across a real keyup of it, until emulateKeyUp', () => {
    keyboard.start();
    const values: boolean[] = [];
    keyboard.bind('Space').subscribe(v => values.push(v));
    keyboard.emulateKeyDown('Space');
    dispatch('keydown', 'Space');
    dispatch('keyup', 'Space');
    expect(values).toEqual([false, true]);
    keyboard.emulateKeyUp('Space');
    expect(values).toEqual([false, true, false]);
    dispatch('keydown', 'Space');
    dispatch('keyup', 'Space');
    expect(values).toEqual([false, true, false, true, false]);
  });

  it('keeps a physically held key down across an emulateKeyUp of it, until its real keyup', () => {
    keyboard.start();
    const values: boolean[] = [];
    keyboard.bind('ShiftLeft').subscribe(v => values.push(v));
    dispatch('keydown', 'ShiftLeft');
    dispatch('keydown', 'ShiftLeft', window, { repeat: true });
    // a gamepad button bound to the same key is pressed and released meanwhile
    keyboard.emulateKeyDown('ShiftLeft');
    keyboard.emulateKeyUp('ShiftLeft');
    expect(values).toEqual([false, true]);
    dispatch('keyup', 'ShiftLeft');
    expect(values).toEqual([false, true, false]);
    // once released by its real keyup, an emulated press/release is a full edge again
    keyboard.emulateKeyDown('ShiftLeft');
    keyboard.emulateKeyUp('ShiftLeft');
    expect(values).toEqual([false, true, false, true, false]);
  });

  it('keeps a key held by two emulated holders down until the last of them lets go', () => {
    keyboard.start();
    const values: boolean[] = [];
    keyboard.bind('Space').subscribe(v => values.push(v));
    const touchButton = {};
    const gamepadBinding = {};
    keyboard.emulateKeyDown('Space', touchButton);
    // a gamepad button bound to the same key is pressed (re-pressed on every poll) and released
    keyboard.emulateKeyDown('Space', gamepadBinding);
    keyboard.emulateKeyDown('Space', gamepadBinding);
    keyboard.emulateKeyUp('Space', gamepadBinding);
    expect(values).toEqual([false, true]);
    keyboard.emulateKeyUp('Space', touchButton);
    expect(values).toEqual([false, true, false]);
  });

  it('counts emulateKeyDown/Up calls without a holder as one holder', () => {
    keyboard.start();
    const values: boolean[] = [];
    keyboard.bind('Space').subscribe(v => values.push(v));
    keyboard.emulateKeyDown('Space');
    keyboard.emulateKeyDown('Space');
    keyboard.emulateKeyUp('Space');
    expect(values).toEqual([false, true, false]);
    // an emulateKeyUp with nothing holding the key is still a release
    keyboard.emulateKeyUp('Space');
    expect(values).toEqual([false, true, false]);
  });

  it('tells whether a holder still holds a key, which a stop or resetAllKeys ends', () => {
    keyboard.start();
    const holder = {};
    keyboard.emulateKeyDown('Enter', holder);
    expect(keyboard.isHeldBy('Enter', holder)).toBe(true);
    expect(keyboard.isHeldBy('Enter')).toBe(false);
    keyboard.resetAllKeys();
    expect(keyboard.isHeldBy('Enter', holder)).toBe(false);
    keyboard.emulateKeyDown('Enter', holder);
    keyboard.stop();
    keyboard.start();
    expect(keyboard.isHeldBy('Enter', holder)).toBe(false);
    keyboard.emulateKeyDown('Enter');
    expect(keyboard.isHeldBy('Enter')).toBe(true);
  });

  it('releases every emulated holder on resetAllKeys', () => {
    keyboard.start();
    const values: boolean[] = [];
    keyboard.bind('Space').subscribe(v => values.push(v));
    keyboard.emulateKeyDown('Space', {});
    keyboard.emulateKeyDown('Space', {});
    keyboard.resetAllKeys();
    expect(values).toEqual([false, true, false]);
    keyboard.emulateKeyDown('Space');
    keyboard.emulateKeyUp('Space');
    expect(values).toEqual([false, true, false, true, false]);
  });

  it('does not take the auto-repeat of a held key for a new press, though it still preventDefault()s it', () => {
    keyboard.start();
    const values: boolean[] = [];
    keyboard.bind('Escape').subscribe(v => values.push(v));

    dispatch('keydown', 'Escape');
    // the key is released by a restart of the input (a screen getting covered and uncovered) while still held
    keyboard.stop();
    keyboard.start();
    const repeated = dispatch('keydown', 'Escape', window, { repeat: true });

    expect(repeated.defaultPrevented).toBe(true);
    expect(values).toEqual([false, true, false]);
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

  it('does not preventDefault() a bound key when a modifier is held (e.g. Alt+ArrowLeft back-navigation, Ctrl/Meta shortcuts), even though the binding still fires', () => {
    keyboard.start();
    const values: boolean[] = [];
    keyboard.bind('ArrowLeft').subscribe(v => values.push(v));

    const altEvent = dispatch('keydown', 'ArrowLeft', window, { altKey: true });
    expect(altEvent.defaultPrevented).toBe(false);

    const ctrlEvent = dispatch('keydown', 'ArrowLeft', window, { ctrlKey: true });
    expect(ctrlEvent.defaultPrevented).toBe(false);

    const metaEvent = dispatch('keydown', 'ArrowLeft', window, { metaKey: true });
    expect(metaEvent.defaultPrevented).toBe(false);

    // the binding itself still sees every keydown - distinctUntilChanged just collapses the
    // repeated `true`s since the key never went back up between dispatches; only the
    // default-action suppression is what's skipped for the modifier-held presses
    expect(values).toEqual([false, true]);
  });

  it("never preventDefault()s Tab even when bound, since that would break the browser's own focus movement", () => {
    keyboard.start();
    keyboard.bind('Tab').subscribe();

    const event = dispatch('keydown', 'Tab');

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

  describe('key names and bindability', () => {
    const setLayout = (layout: Record<string, string> | undefined) =>
      Object.defineProperty(navigator, 'keyboard', {
        configurable: true,
        value: layout && { getLayoutMap: () => Promise.resolve(new Map(Object.entries(layout))) },
      });

    afterEach(async () => {
      delete (navigator as any).keyboard;
      await KeyboardInput.loadKeyboardLayout();
    });

    it('names keys after the US layout when the browser does not tell the layout', async () => {
      expect(await KeyboardInput.loadKeyboardLayout()).toBe(false);
      expect(KeyboardInput.keyName('KeyQ')).toBe('Q');
      expect(KeyboardInput.keyName('Digit1')).toBe('1');
      expect(KeyboardInput.keyName('Numpad8')).toBe('Num 8');
      expect(KeyboardInput.keyName('Semicolon')).toBe(';');
      expect(KeyboardInput.keyName('ArrowLeft')).toBe('Left');
      // a code from saved data that an object would have as a member
      expect(KeyboardInput.keyName('constructor')).toBe('constructor');
      expect(KeyboardInput.keyName('toString')).toBe('toString');
      expect(KeyboardInput.keyName('ShiftLeft')).toBe('L Shift');
      expect(KeyboardInput.keyName('Space')).toBe('Space');
      expect(KeyboardInput.keyName('F7')).toBe('F7');
    });

    it("names keys after the player's layout once loaded", async () => {
      setLayout({ KeyQ: 'a', Digit1: '&', Semicolon: 'm', Space: ' ', Minus: 'ß' });
      expect(await KeyboardInput.loadKeyboardLayout()).toBe(true);
      expect(KeyboardInput.keyName('KeyQ')).toBe('A');
      // a one-character label stays one: 'ß'.toUpperCase() is 'SS'
      expect(KeyboardInput.keyName('Minus')).toBe('ß');
      expect(KeyboardInput.keyName('Digit1')).toBe('&');
      expect(KeyboardInput.keyName('Semicolon')).toBe('M');
      expect(KeyboardInput.keyName('Space')).toBe('Space');
      expect(KeyboardInput.keyName('ArrowUp')).toBe('Up');
      // not in the layout map
      expect(KeyboardInput.keyName('KeyW')).toBe('W');
    });

    it('resolves false rather than rejecting when the layout is withheld', async () => {
      Object.defineProperty(navigator, 'keyboard', {
        configurable: true,
        value: { getLayoutMap: () => Promise.reject(new DOMException('not allowed', 'SecurityError')) },
      });
      expect(await KeyboardInput.loadKeyboardLayout()).toBe(false);
      expect(KeyboardInput.keyName('KeyQ')).toBe('Q');
    });

    it('refuses browser, OS, modifier and lock keys as bindable', () => {
      for (const code of ['KeyW', 'ArrowUp', 'Space', 'ShiftLeft', 'Numpad5', 'Digit0', 'Enter', 'Backquote']) {
        expect(KeyboardInput.isBindable(code)).toBe(true);
      }
      for (const code of [
        '',
        'Unidentified',
        'Tab',
        'Escape',
        'F5',
        'F12',
        'ControlLeft',
        'AltRight',
        'MetaLeft',
        'CapsLock',
        'MediaPlayPause',
        'AudioVolumeUp',
        'BrowserBack',
        'ContextMenu',
      ]) {
        expect(KeyboardInput.isBindable(code)).toBe(false);
      }
    });
  });
});
