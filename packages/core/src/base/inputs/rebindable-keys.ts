import { combineLatest, distinctUntilChanged, isObservable, Observable, of, switchMap } from 'rxjs';
import { KeyboardInput } from './keyboard.input';
import { DirectionInput } from './direction.input';
import { GamepadControls, GamepadDirectionBinding, GamepadInput } from './gamepad.input';

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

/** Two bindings as plain data, compared by content */
const sameBinding = (a: unknown, b: unknown): boolean => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/**
 * `GamepadInput.bindKeys` for one key whose code and controls can both change: while `controls`
 * are pushed, holds the key `code$` names last on `keyboard`. A new code or new controls move the
 * hold over (the old key is let go of); a `null` code or controls bind nothing. Returns a function
 * that unbinds for good.
 */
export function followGamepadKey(
  gamepadInput: GamepadInput,
  keyboard: KeyboardInput,
  code$: Observable<string | null>,
  controls: GamepadControls | null | undefined | Observable<GamepadControls | null | undefined>,
): () => void {
  const controls$ = isObservable(controls) ? controls : of(controls);
  let unbind: (() => void) | null = null;
  const subscription = combineLatest([code$, controls$])
    .pipe(distinctUntilChanged(([codeA, a], [codeB, b]) => codeA === codeB && sameBinding(a, b)))
    .subscribe(([code, current]) => {
      unbind?.();
      unbind = code && current ? gamepadInput.bindKeys(keyboard, { [code]: current }) : null;
    });
  return () => {
    subscription.unsubscribe();
    unbind?.();
    unbind = null;
  };
}

/**
 * `GamepadInput.bindDirection` for a binding that can change: adds the direction `binding$` names
 * last to `direction`, `null` for none. A new binding withdraws the old one's contribution first.
 * Returns a function that unbinds for good.
 */
export function followGamepadDirection(
  gamepadInput: GamepadInput,
  direction: DirectionInput,
  binding$: Observable<GamepadDirectionBinding | null | undefined>,
): () => void {
  let unbind: (() => void) | null = null;
  const subscription = binding$.pipe(distinctUntilChanged(sameBinding)).subscribe(binding => {
    unbind?.();
    unbind = binding ? gamepadInput.bindDirection(direction, binding) : null;
  });
  return () => {
    subscription.unsubscribe();
    unbind?.();
    unbind = null;
  };
}
