import { BehaviorSubject, NEVER, of, Subject } from 'rxjs';
import {
  BindingsChange,
  DirectionInput,
  DirectionKeymap,
  followGamepadDirection,
  followGamepadKey,
  followGamepadPressed,
  followKey,
  GAMEPAD_DPAD,
  GAMEPAD_LEFT_STICK,
  GamepadInput,
  isRebindableController,
  KeyboardInput,
} from '../../../src';
import { ControllerBindings } from '../../../src/base/inputs/rebindable-keys';
import { stubGamepads } from '../../mocks/gamepad.mock';

describe('followKey', () => {
  let keyboard: KeyboardInput;

  beforeEach(() => {
    keyboard = new KeyboardInput();
    keyboard.start();
  });

  afterEach(() => keyboard.stop());

  it("follows the latest code's key, letting go of a held old key at once", () => {
    const code$ = new BehaviorSubject<string | null>('Space');
    const values: boolean[] = [];
    followKey(keyboard, code$).subscribe(v => values.push(v));

    keyboard.emulateKeyDown('Space');
    code$.next('KeyJ');
    // still held, but no longer the key
    keyboard.emulateKeyUp('Space');
    keyboard.emulateKeyDown('Space');
    keyboard.emulateKeyDown('KeyJ');
    keyboard.emulateKeyUp('KeyJ');

    expect(values).toEqual([false, true, false, true, false]);
  });

  it('reports false for no key, and keeps the binding when the same code comes again', () => {
    const code$ = new BehaviorSubject<string | null>(null);
    const values: boolean[] = [];
    followKey(keyboard, code$).subscribe(v => values.push(v));
    keyboard.emulateKeyDown('KeyJ');
    expect(values).toEqual([false]);

    code$.next('KeyK');
    keyboard.emulateKeyDown('KeyK');
    code$.next('KeyK');
    expect(values).toEqual([false, true]);
  });

  it('leaves no binding behind when unsubscribed', () => {
    const code$ = new BehaviorSubject<string | null>('KeyA');
    const subscription = followKey(keyboard, code$).subscribe();
    code$.next('KeyB');
    subscription.unsubscribe();
    expect((keyboard as any).bindings.get('KeyA')).toEqual([]);
    expect((keyboard as any).bindings.get('KeyB')).toEqual([]);
  });
});

describe('followGamepadKey', () => {
  let pads: ReturnType<typeof stubGamepads>;
  let gamepadInput: GamepadInput;
  let keyboard: KeyboardInput;

  beforeEach(() => {
    pads = stubGamepads();
    gamepadInput = new GamepadInput();
    gamepadInput.start();
    // a binding waits for a read of the gamepad with its control released: one poll with nothing pushed
    gamepadInput.poll();
    keyboard = new KeyboardInput();
    keyboard.start();
  });

  afterEach(() => {
    keyboard.stop();
    gamepadInput.stop();
    pads.restore();
  });

  it('holds the latest code while the button is pushed, moving the hold over on a new code', () => {
    const code$ = new BehaviorSubject<string | null>('Space');
    const space: boolean[] = [];
    const j: boolean[] = [];
    keyboard.bind('Space').subscribe(v => space.push(v));
    keyboard.bind('KeyJ').subscribe(v => j.push(v));
    const unbind = followGamepadKey(gamepadInput, keyboard, code$, of('b0'));

    pads.set({ buttons: { 0: true } });
    gamepadInput.poll();
    code$.next('KeyJ');
    gamepadInput.poll();
    // the old key let go of at once; the new one only from the button's next push
    expect(space).toEqual([false, true, false]);
    expect(j).toEqual([false]);
    pads.set({ buttons: {} });
    gamepadInput.poll();
    pads.set({ buttons: { 0: true } });
    gamepadInput.poll();
    pads.set({ buttons: {} });
    gamepadInput.poll();
    expect(j).toEqual([false, true, false]);

    code$.next(null);
    pads.set({ buttons: { 0: true } });
    gamepadInput.poll();
    expect(j).toEqual([false, true, false]);
    expect(space).toEqual([false, true, false]);
    unbind();
  });

  it('does not press the key for a control already held when it is assigned', () => {
    const values: boolean[] = [];
    keyboard.bind('Space').subscribe(v => values.push(v));
    const controls$ = new BehaviorSubject<string | null>('b0');
    pads.set({ buttons: { 1: true } });
    gamepadInput.poll();
    // a controls menu captured B while it is still down
    const unbind = followGamepadKey(gamepadInput, keyboard, new BehaviorSubject<string | null>('Space'), controls$);
    controls$.next('b1');
    gamepadInput.poll();
    expect(values).toEqual([false]);
    pads.set({ buttons: {} });
    gamepadInput.poll();
    pads.set({ buttons: { 1: true } });
    gamepadInput.poll();
    expect(values).toEqual([false, true]);
    unbind();
    expect(values).toEqual([false, true, false]);
  });

  it('does not press the key on restart for a control held while it was assigned with the input stopped', () => {
    const values: boolean[] = [];
    keyboard.bind('Space').subscribe(v => values.push(v));
    const controls$ = new BehaviorSubject<string | null>('b0');
    const unbind = followGamepadKey(gamepadInput, keyboard, new BehaviorSubject<string | null>('Space'), controls$);
    // a controls menu over the game: the world's gamepad input is stopped, every control reads
    // released, and the menu captures B while it is still down
    pads.set({ buttons: { 1: true } });
    gamepadInput.stop();
    controls$.next('b1');
    // the menu closes with B still held
    gamepadInput.start();
    gamepadInput.poll();
    expect(values).toEqual([false]);
    pads.set({ buttons: {} });
    gamepadInput.poll();
    pads.set({ buttons: { 1: true } });
    gamepadInput.poll();
    expect(values).toEqual([false, true]);
    unbind();
  });

  it('followGamepadPressed does not count a control held while it was assigned with the input stopped', () => {
    const controls$ = new BehaviorSubject<string | null>('b0');
    const values: boolean[] = [];
    followGamepadPressed(gamepadInput, controls$).subscribe(v => values.push(v));
    pads.set({ buttons: { 5: true } });
    gamepadInput.stop();
    controls$.next('b5');
    gamepadInput.start();
    gamepadInput.poll();
    expect(values).toEqual([false]);
    pads.set({ buttons: {} });
    gamepadInput.poll();
    pads.set({ buttons: { 5: true } });
    gamepadInput.poll();
    expect(values).toEqual([false, true]);
  });

  it('followGamepadPressed counts a control assigned released with the input stopped from the first push after the restart', () => {
    const controls$ = new BehaviorSubject<string | null>(null);
    const values: boolean[] = [];
    followGamepadPressed(gamepadInput, controls$).subscribe(v => values.push(v));
    gamepadInput.stop();
    controls$.next('b5');
    gamepadInput.start();
    pads.set({ buttons: {} });
    gamepadInput.poll();
    pads.set({ buttons: { 5: true } });
    gamepadInput.poll();
    expect(values).toEqual([false, true]);
  });

  it('followGamepadPressed reports a control from its next push when it is assigned held, and not a repeat of the same controls', () => {
    const controls$ = new BehaviorSubject<string | null>('b5');
    const values: boolean[] = [];
    pads.set({ buttons: { 5: true } });
    gamepadInput.poll();
    followGamepadPressed(gamepadInput, controls$).subscribe(v => values.push(v));
    expect(values).toEqual([false]);
    controls$.next('b5');
    gamepadInput.poll();
    expect(values).toEqual([false]);
    pads.set({ buttons: {} });
    gamepadInput.poll();
    pads.set({ buttons: { 5: true } });
    gamepadInput.poll();
    expect(values).toEqual([false, true]);
    controls$.next(null);
    expect(values).toEqual([false, true, false]);
    controls$.next('b3');
    pads.set({ buttons: { 3: true } });
    gamepadInput.poll();
    expect(values).toEqual([false, true, false, true]);
  });

  it('does not press the key for a control held at the first poll after a start', () => {
    // a world's input switched on (gamepad input started) and a binding made in the same frame, with
    // the button that closed the menu still held: nothing has been read yet, so the hold waits
    const values: boolean[] = [];
    keyboard.bind('Space').subscribe(v => values.push(v));
    gamepadInput.stop();
    gamepadInput.start();
    const unbind = followGamepadKey(gamepadInput, keyboard, of('Space'), of('b0'));
    pads.set({ buttons: { 0: true } });
    gamepadInput.poll();
    expect(values).toEqual([false]);
    pads.set({ buttons: {} });
    gamepadInput.poll();
    pads.set({ buttons: { 0: true } });
    gamepadInput.poll();
    expect(values).toEqual([false, true]);
    unbind();
  });

  it('moves the hold over to new controls of the same key', () => {
    const values: boolean[] = [];
    keyboard.bind('KeyE').subscribe(v => values.push(v));
    const controls$ = new BehaviorSubject<string | null>('b5');
    const unbind = followGamepadKey(gamepadInput, keyboard, new BehaviorSubject<string | null>('KeyE'), controls$);
    pads.set({ buttons: { 5: true } });
    gamepadInput.poll();
    controls$.next('b3');
    gamepadInput.poll();
    pads.set({ buttons: { 3: true } });
    gamepadInput.poll();
    expect(values).toEqual([false, true, false, true]);
    unbind();
  });

  it('followGamepadDirection follows the latest binding, withdrawing the old one', () => {
    const direction = new DirectionInput();
    direction.start();
    const binding$ = new BehaviorSubject<any>(GAMEPAD_LEFT_STICK);
    const unbind = followGamepadDirection(gamepadInput, direction, binding$);
    pads.set({ axes: [1, 0], buttons: { 14: true } });
    gamepadInput.poll();
    expect(direction.direction).toEqual({ x: 1, y: 0 });
    binding$.next(GAMEPAD_DPAD);
    expect(direction.direction).toEqual({ x: -1, y: 0 });
    binding$.next(null);
    expect(direction.direction).toEqual({ x: 0, y: 0 });
    gamepadInput.poll();
    expect(direction.direction).toEqual({ x: 0, y: 0 });
    unbind();
    direction.stop();
  });

  it('lets go of the held key when unbound', () => {
    const values: boolean[] = [];
    keyboard.bind('KeyE').subscribe(v => values.push(v));
    const unbind = followGamepadKey(gamepadInput, keyboard, new BehaviorSubject<string | null>('KeyE'), of('b5'));
    pads.set({ buttons: { 5: true } });
    gamepadInput.poll();
    unbind();
    gamepadInput.poll();
    expect(values).toEqual([false, true, false]);
  });
});

describe('ControllerBindings', () => {
  type Options = { fireKey: string; keymap: string; gamepad: { fire: string; alt: string } | null };
  const DEFAULT_GAMEPAD = { fire: 'b0', alt: 'b1' };

  it('writes the keys given, skipping undefined, and reports a keys change', () => {
    const options: Options = { fireKey: 'KeyF', keymap: 'wasd', gamepad: null };
    const bindings = new ControllerBindings(options, DEFAULT_GAMEPAD, NEVER);
    const changes: BindingsChange[] = [];
    bindings.changed$.subscribe(c => changes.push(c));
    const fireKeys: string[] = [];
    bindings.option$(o => o.fireKey).subscribe(k => fireKeys.push(k));
    bindings.setKeys({ fireKey: 'KeyG', keymap: undefined });
    expect(options).toEqual({ fireKey: 'KeyG', keymap: 'wasd', gamepad: null });
    expect(changes).toEqual(['keys']);
    expect(fireKeys).toEqual(['KeyF', 'KeyG']);
  });

  it('keeps a direction input at the picked keymap through setKeys until unbindOn$ emits', () => {
    const options: Options = { fireKey: 'KeyF', keymap: 'wasd', gamepad: null };
    const unbindOn$ = new Subject<void>();
    const bindings = new ControllerBindings(options, DEFAULT_GAMEPAD, unbindOn$);
    const direction = new DirectionInput(new KeyboardInput(), 'arrows');
    bindings.followKeymap(direction, o => o.keymap as DirectionKeymap);
    expect(direction.keymap).toBe('wasd');
    bindings.setKeys({ keymap: 'arrows' });
    expect(direction.keymap).toBe('arrows');
    unbindOn$.next();
    bindings.setKeys({ keymap: 'wasd' });
    expect(direction.keymap).toBe('arrows');
  });

  it('merges a gamepad partial over the current binding, the default while off, and null turns it off', () => {
    const options: Options = { fireKey: 'KeyF', keymap: 'wasd', gamepad: null };
    const bindings = new ControllerBindings(options, DEFAULT_GAMEPAD, NEVER);
    const changes: BindingsChange[] = [];
    bindings.changed$.subscribe(c => changes.push(c));
    expect(bindings.setGamepad({ fire: 'b3' })).toEqual({ fire: 'b3', alt: 'b1' });
    expect(options.gamepad).toEqual({ fire: 'b3', alt: 'b1' });
    bindings.setGamepad({ alt: 'b4' });
    expect(options.gamepad).toEqual({ fire: 'b3', alt: 'b4' });
    expect(bindings.setGamepad(null)).toBeNull();
    expect(options.gamepad).toBeNull();
    expect(changes).toEqual(['gamepad', 'gamepad', 'gamepad']);
  });

  it('leaves the controls given as undefined to setGamepad as they are', () => {
    const options: Options = { fireKey: 'KeyF', keymap: 'wasd', gamepad: { fire: 'b3', alt: 'b4' } };
    const bindings = new ControllerBindings(options, DEFAULT_GAMEPAD, NEVER);
    expect(bindings.setGamepad({ fire: 'b5', alt: undefined })).toEqual({ fire: 'b5', alt: 'b4' });
    expect(options.gamepad).toEqual({ fire: 'b5', alt: 'b4' });
  });

  it('binds a gamepad key over the picked key and control, and unbinds when unbindOn$ emits', () => {
    const pads = stubGamepads();
    const gamepadInput = new GamepadInput();
    gamepadInput.start();
    const keyboard = new KeyboardInput();
    keyboard.start();
    try {
      const options: Options = { fireKey: 'KeyF', keymap: 'wasd', gamepad: { ...DEFAULT_GAMEPAD } };
      const removed$ = new Subject<void>();
      const bindings = new ControllerBindings(options, DEFAULT_GAMEPAD, removed$);
      const fire: boolean[] = [];
      bindings.followKey(keyboard, o => o.fireKey).subscribe(v => fire.push(v));
      bindings.followGamepadKey(
        gamepadInput,
        keyboard,
        o => o.fireKey,
        g => g.fire,
      );
      pads.set({});
      gamepadInput.poll();
      pads.set({ buttons: { 0: true } });
      gamepadInput.poll();
      expect(fire).toEqual([false, true]);
      pads.set({});
      gamepadInput.poll();
      // the key and the button both rebound: G from the next push of B
      bindings.setKeys({ fireKey: 'KeyG' });
      bindings.setGamepad({ fire: 'b1' });
      pads.set({ buttons: { 1: true } });
      gamepadInput.poll();
      expect(fire).toEqual([false, true, false, true]);
      pads.set({});
      gamepadInput.poll();
      // off: the button presses nothing
      bindings.setGamepad(null);
      pads.set({ buttons: { 1: true } });
      gamepadInput.poll();
      expect(fire).toEqual([false, true, false, true, false]);
      bindings.setGamepad({});
      pads.set({});
      gamepadInput.poll();
      removed$.next();
      pads.set({ buttons: { 1: true } });
      gamepadInput.poll();
      expect(fire).toEqual([false, true, false, true, false]);
      expect((keyboard as any).emulatedHeld.size).toBe(0);
    } finally {
      keyboard.stop();
      gamepadInput.stop();
      pads.restore();
    }
  });

  it('follows a gamepad direction and a pressed control picked from the gamepad binding', () => {
    const pads = stubGamepads();
    const gamepadInput = new GamepadInput();
    gamepadInput.start();
    try {
      const options = { gamepad: { move: GAMEPAD_LEFT_STICK, alt: 'b1' } as { move: any; alt: string } | null };
      const removed$ = new Subject<void>();
      const bindings = new ControllerBindings(options, { move: GAMEPAD_LEFT_STICK, alt: 'b1' }, removed$);
      const direction = new DirectionInput(null, null);
      direction.start();
      const alt: boolean[] = [];
      bindings.followGamepadPressed(gamepadInput, g => g.alt).subscribe(v => alt.push(v));
      bindings.followGamepadDirection(gamepadInput, direction, g => g.move);
      pads.set({});
      gamepadInput.poll();
      pads.set({ axes: [1, 0], buttons: { 1: true } });
      gamepadInput.poll();
      expect(direction.direction).toEqual({ x: 1, y: 0 });
      expect(alt).toEqual([false, true]);
      bindings.setGamepad(null);
      gamepadInput.poll();
      expect(direction.direction).toEqual({ x: 0, y: 0 });
      expect(alt).toEqual([false, true, false]);
      direction.stop();
    } finally {
      gamepadInput.stop();
      pads.restore();
    }
  });

  it('isRebindableController tells a controller with a bindingsChanged$', () => {
    const bindings = new ControllerBindings({ gamepad: null }, {}, NEVER);
    expect(isRebindableController({ bindingsChanged$: bindings.changed$ })).toBe(true);
    expect(isRebindableController({ bindingsChanged$: () => undefined })).toBe(false);
    expect(isRebindableController(null)).toBe(false);
  });
});
