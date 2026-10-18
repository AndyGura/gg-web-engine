import { BehaviorSubject } from 'rxjs';
import { followGamepadKey, followKey, GamepadInput, KeyboardInput } from '../../../src';
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
    expect((keyboard as any).bindings['KeyA']).toEqual([]);
    expect((keyboard as any).bindings['KeyB']).toEqual([]);
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
    const unbind = followGamepadKey(gamepadInput, keyboard, code$, 'b0');

    pads.set({ buttons: { 0: true } });
    gamepadInput.poll();
    code$.next('KeyJ');
    gamepadInput.poll();
    pads.set({ buttons: {} });
    gamepadInput.poll();

    expect(space).toEqual([false, true, false]);
    expect(j).toEqual([false, true, false]);

    code$.next(null);
    pads.set({ buttons: { 0: true } });
    gamepadInput.poll();
    expect(j).toEqual([false, true, false]);
    expect(space).toEqual([false, true, false]);
    unbind();
  });

  it('lets go of the held key when unbound', () => {
    const values: boolean[] = [];
    keyboard.bind('KeyE').subscribe(v => values.push(v));
    const unbind = followGamepadKey(gamepadInput, keyboard, new BehaviorSubject<string | null>('KeyE'), 'b5');
    pads.set({ buttons: { 5: true } });
    gamepadInput.poll();
    unbind();
    gamepadInput.poll();
    expect(values).toEqual([false, true, false]);
  });
});
