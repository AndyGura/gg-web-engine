import { distinctUntilChanged, Observable, of, switchMap } from 'rxjs';
import { KeyboardInput } from './keyboard.input';
import { GamepadControls, GamepadInput } from './gamepad.input';

/**
 * The state of whichever key `code$` names last, for an action whose key can be rebound: `true`
 * while that key is held, `false` otherwise and for a `null` code (no key). When the code changes
 * the old key stops counting at once (a held one reports `false`), and a new key already held
 * counts from its next press. Emits the current state on subscription.
 *
 * @example
 * ```ts
 * const jumpKey$ = new BehaviorSubject('Space');
 * followKey(world.keyboardInput, jumpKey$).subscribe(down => down && player.jump());
 * jumpKey$.next('KeyJ'); // a controls menu rebinding it
 * ```
 */
export function followKey(keyboard: KeyboardInput, code$: Observable<string | null>): Observable<boolean> {
  return code$.pipe(
    distinctUntilChanged(),
    switchMap(code => (code ? keyboard.bind(code) : of(false))),
    distinctUntilChanged(),
  );
}

/**
 * `GamepadInput.bindKeys` for one key that can be rebound: while `controls` are pushed, holds the
 * key `code$` names last on `keyboard`. A new code moves the hold over (the old key is let go of);
 * `null` binds nothing. Returns a function that unbinds for good.
 */
export function followGamepadKey(
  gamepadInput: GamepadInput,
  keyboard: KeyboardInput,
  code$: Observable<string | null>,
  controls: GamepadControls | null | undefined,
): () => void {
  let unbind: (() => void) | null = null;
  const subscription = code$.pipe(distinctUntilChanged()).subscribe(code => {
    unbind?.();
    unbind = code && controls ? gamepadInput.bindKeys(keyboard, { [code]: controls }) : null;
  });
  return () => {
    subscription.unsubscribe();
    unbind?.();
    unbind = null;
  };
}
