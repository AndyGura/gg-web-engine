import {
  combineLatest,
  distinctUntilChanged,
  filter,
  isObservable,
  map,
  Observable,
  of,
  skipWhile,
  startWith,
  Subject,
  switchMap,
  take,
} from 'rxjs';
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

/**
 * Whether two gamepad bindings (`GamepadControls`, a `GamepadDirectionBinding`, a whole binding
 * object) are the same, compared by content; `null` and `undefined` are the same binding (none).
 * The comparator for a `distinctUntilChanged` over an observable of bindings.
 */
export const sameBinding = <T>(a: T, b: T): boolean => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/**
 * `GamepadInput.pressed$` for controls that can change: whether the controls `controls$` names
 * last are pushed, `false` for none. Controls already pushed when they are assigned (a menu
 * capturing the very button that is still held) count from their next push, and a repeat of the
 * same controls (`setKeys` emitting too) leaves a held button alone, so an edge-triggered action
 * subscribed to this never fires on the rebinding itself. Emits the current state on subscription.
 */
export function followGamepadPressed(
  gamepadInput: GamepadInput,
  controls$: Observable<GamepadControls | null | undefined>,
): Observable<boolean> {
  return controls$.pipe(
    distinctUntilChanged(sameBinding),
    switchMap(controls =>
      controls
        ? gamepadInput.pressed$(controls).pipe(
            skipWhile(down => down),
            startWith(false),
          )
        : of(false),
    ),
    distinctUntilChanged(),
  );
}

/**
 * `GamepadInput.bindKeys` for one key whose code and controls can both change: while `controls`
 * are pushed, holds the key `code$` names last on `keyboard`. A new code or new controls move the
 * hold over (the old key is let go of), once the controls are released if they are pushed at that
 * moment - a control a menu captured is still held when it is assigned, and must not act on the
 * spot; a `null` code or controls bind nothing. Returns a function that unbinds for good.
 */
export function followGamepadKey(
  gamepadInput: GamepadInput,
  keyboard: KeyboardInput,
  code$: Observable<string | null>,
  controls: GamepadControls | null | undefined | Observable<GamepadControls | null | undefined>,
): () => void {
  const controls$ = isObservable(controls) ? controls : of(controls);
  let unbind: (() => void) | null = null;
  const bindOnceReleased = (code: string, current: GamepadControls): (() => void) => {
    let bound: (() => void) | null = null;
    const waiting = gamepadInput
      .pressed$(current)
      .pipe(
        filter(down => !down),
        take(1),
      )
      .subscribe(() => (bound = gamepadInput.bindKeys(keyboard, { [code]: current })));
    return () => {
      waiting.unsubscribe();
      bound?.();
    };
  };
  const subscription = combineLatest([code$, controls$])
    .pipe(distinctUntilChanged(([codeA, a], [codeB, b]) => codeA === codeB && sameBinding(a, b)))
    .subscribe(([code, current]) => {
      unbind?.();
      unbind = code && current ? bindOnceReleased(code, current) : null;
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

/** What a `bindingsChanged$` emission says changed: the keys (`setKeys`) or the gamepad (`setGamepad`) */
export type BindingsChange = 'keys' | 'gamepad';

/**
 * A controller whose bindings change while the game runs: every built-in input controller
 * (`setKeys`/`setGamepad`), or one of the app's own. Whatever shows or uses a controller's
 * bindings - an on-screen hint, the touch layout of `@gg-web-engine/mobile-controls`, which
 * rebuilds itself on a `'keys'` change - subscribes to `bindingsChanged$`.
 */
export interface IRebindableController {
  /** Emits after every change of the controller's bindings, with which side changed */
  readonly bindingsChanged$: Observable<BindingsChange>;
}

/** Whether `x` is an `IRebindableController` */
export function isRebindableController(x: unknown): x is IRebindableController {
  return !!x && typeof x === 'object' && isObservable((x as { bindingsChanged$?: unknown }).bindingsChanged$);
}

/**
 * The rebinding mechanism of a controller with an `options` object holding its keys and an
 * optional `gamepad` binding, written once here and used by every built-in input controller:
 * `setKeys` copies the given keys onto `options` (skipping `undefined` ones), `setGamepad` writes
 * `options.gamepad` (`null`, or the partial over the current binding - over `defaultGamepad` while
 * the gamepad is off), and both emit on `changed$`. `option$(pick)` is what a binding made in
 * `onSpawned` follows (`followKey`, `followGamepadKey`, `followGamepadDirection`): the picked value
 * now and after every change. The controller's `bindingsChanged$` is `changed$`.
 *
 * @example
 * ```ts
 * class MyController extends IEntity implements IRebindableController {
 *   private readonly bindings = new ControllerBindings(this.options, DEFAULT_MY_GAMEPAD_BINDING);
 *   get bindingsChanged$() { return this.bindings.changed$; }
 *   setKeys(keys: Partial<MyControllerKeys>) { this.bindings.setKeys(keys); }
 *   setGamepad(binding: Partial<MyGamepadBinding> | null) { this.bindings.setGamepad(binding); }
 *   onSpawned(world) {
 *     followKey(this.keyboard, this.bindings.option$(o => o.fireKey)).subscribe(down => down && this.fire());
 *   }
 * }
 * ```
 */
export class ControllerBindings<O extends { gamepad?: G | null }, G extends object> {
  private readonly _changed$: Subject<BindingsChange> = new Subject<BindingsChange>();

  constructor(
    private readonly options: O,
    private readonly defaultGamepad: G,
  ) {}

  /** Emits after every `setKeys` (`'keys'`) and `setGamepad` (`'gamepad'`) */
  public get changed$(): Observable<BindingsChange> {
    return this._changed$.asObservable();
  }

  /** What `pick` reads from `options`, now and after every change */
  public option$<T>(pick: (options: O) => T): Observable<T> {
    return this._changed$.pipe(
      startWith(undefined),
      map(() => pick(this.options)),
    );
  }

  /** Copies the keys given (not the `undefined` ones) onto `options` and emits `'keys'` */
  public setKeys(keys: Partial<O>): void {
    for (const name of Object.keys(keys) as (keyof O)[]) {
      if (keys[name] !== undefined) {
        this.options[name] = keys[name] as O[keyof O];
      }
    }
    this._changed$.next('keys');
  }

  /**
   * Writes `options.gamepad`: `null` turns the gamepad off, a partial goes over the current binding
   * (over `defaultGamepad` while the gamepad is off or left out). Emits `'gamepad'` and returns the
   * binding written.
   */
  public setGamepad(binding: Partial<G> | null): G | null {
    const next = binding === null ? null : { ...(this.options.gamepad ?? this.defaultGamepad), ...binding };
    this.options.gamepad = next;
    this._changed$.next('gamepad');
    return next;
  }
}
