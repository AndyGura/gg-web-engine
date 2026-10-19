import {
  combineLatest,
  distinctUntilChanged,
  isObservable,
  map,
  Observable,
  of,
  startWith,
  Subject,
  switchMap,
  take,
} from 'rxjs';
import { KeyboardInput } from './keyboard.input';
import { DirectionInput, DirectionKeymap } from './direction.input';
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
 * capturing the very button that is still held) count from their next push - from a push `gamepadInput`
 * reads while running, so a gamepad input stopped for the menu does not make a held button count
 * on its restart (`GamepadInput.released$`) - and a repeat of the same controls (`setKeys`
 * emitting too) leaves a held button alone, so an edge-triggered action subscribed to this never
 * fires on the rebinding itself. Emits the current state on subscription.
 */
export function followGamepadPressed(
  gamepadInput: GamepadInput,
  controls$: Observable<GamepadControls | null | undefined>,
): Observable<boolean> {
  return controls$.pipe(
    distinctUntilChanged(sameBinding),
    switchMap(controls =>
      controls
        ? gamepadInput.released$(controls).pipe(
            switchMap(() => gamepadInput.pressed$(controls)),
            startWith(false),
          )
        : of(false),
    ),
    distinctUntilChanged(),
  );
}

/**
 * `GamepadInput.bindKeys` for one key whose code and controls can both change: while the controls
 * `controls$` names last are pushed, holds the key `code$` names last on `keyboard`. A new code or
 * new controls move the hold over (the old key is let go of), once the controls are read released
 * by a running `gamepadInput` if they are pushed at that moment (`GamepadInput.released$`) - a
 * control a menu captured is still held when it is assigned, and must not act on the spot, nor
 * when the gamepad input stopped for the menu restarts; a `null` code or controls bind nothing.
 * Returns a function that unbinds for good.
 */
export function followGamepadKey(
  gamepadInput: GamepadInput,
  keyboard: KeyboardInput,
  code$: Observable<string | null>,
  controls$: Observable<GamepadControls | null | undefined>,
): () => void {
  return followGamepadKeyPair(gamepadInput, keyboard, combineLatest([code$, controls$]));
}

/**
 * `followGamepadKey` over one observable of the code and controls together: one emission per
 * change where a `combineLatest` of two streams derived from the same source would give two
 */
function followGamepadKeyPair(
  gamepadInput: GamepadInput,
  keyboard: KeyboardInput,
  pair$: Observable<readonly [string | null, GamepadControls | null | undefined]>,
): () => void {
  let unbind: (() => void) | null = null;
  const bindOnceReleased = (code: string, current: GamepadControls): (() => void) => {
    let bound: (() => void) | null = null;
    const waiting = gamepadInput
      .released$(current)
      .subscribe(() => (bound = gamepadInput.bindKeys(keyboard, { [code]: current })));
    return () => {
      waiting.unsubscribe();
      bound?.();
    };
  };
  const subscription = pair$
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
 * the gamepad is off), and both emit on `changed$`. The bindings a controller makes in `onSpawned`
 * follow the options from then on: `followKey`, `followGamepadKey`, `followGamepadPressed` and
 * `followGamepadDirection` here are the functions of the same names over a key picked from
 * `options` and a control picked from `options.gamepad` (nothing while that is `null`), and the
 * two that bind are unbound when `unbindOn$` next emits - the controller's `_onRemoved$`.
 * `followKeymap(directionInput, pick)` keeps a `DirectionInput`'s `keymap` at the one picked from
 * `options`, unbound the same way. `option$
 * (pick)` is the picked value now and after every change, for anything else that follows an
 * option. The controller's `bindingsChanged$` is `changed$`.
 *
 * @example
 * ```ts
 * class MyController extends IEntity implements IRebindableController {
 *   private readonly bindings = new ControllerBindings(this.options, DEFAULT_MY_GAMEPAD_BINDING, this._onRemoved$);
 *   get bindingsChanged$() { return this.bindings.changed$; }
 *   setKeys(keys: Partial<MyControllerKeys>) { this.bindings.setKeys(keys); }
 *   setGamepad(binding: Partial<MyGamepadBinding> | null) { this.bindings.setGamepad(binding); }
 *   onSpawned(world) {
 *     this.bindings.followKey(this.keyboard, o => o.fireKey)
 *       .pipe(takeUntil(this._onRemoved$))
 *       .subscribe(down => down && this.fire());
 *     if (world.gamepadInput) {
 *       this.bindings.followGamepadKey(world.gamepadInput, this.keyboard, o => o.fireKey, g => g.fire);
 *     }
 *   }
 * }
 * ```
 */
export class ControllerBindings<O extends { gamepad?: G | null }, G extends object> {
  private readonly _changed$: Subject<BindingsChange> = new Subject<BindingsChange>();

  /**
   * @param options The controller's options, written to by `setKeys`/`setGamepad`
   * @param defaultGamepad The binding a `setGamepad` partial goes over while the gamepad is off
   * @param unbindOn$ When the gamepad bindings made by `followGamepadKey`/`followGamepadDirection`
   * are unbound: the controller's `_onRemoved$`
   */
  constructor(
    private readonly options: O,
    private readonly defaultGamepad: G,
    private readonly unbindOn$: Observable<unknown>,
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

  /** What `pick` reads from `options.gamepad`, now and after every change; `null` while the gamepad is off */
  public gamepadOption$<T>(pick: (gamepad: G) => T): Observable<T | null> {
    return this.option$(o => (o.gamepad ? pick(o.gamepad) : null));
  }

  /** `followKey` over the key `pickCode` picks from `options` */
  public followKey(keyboard: KeyboardInput, pickCode: (options: O) => string | null): Observable<boolean> {
    return followKey(keyboard, this.option$(pickCode));
  }

  /**
   * `followGamepadKey` over the key `pickCode` picks from `options` and the controls `pickControls`
   * picks from `options.gamepad`, unbound when `unbindOn$` next emits
   */
  public followGamepadKey(
    gamepadInput: GamepadInput,
    keyboard: KeyboardInput,
    pickCode: (options: O) => string | null,
    pickControls: (gamepad: G) => GamepadControls | null | undefined,
  ): void {
    this.untilUnbound(
      followGamepadKeyPair(
        gamepadInput,
        keyboard,
        this.option$(o => [pickCode(o), o.gamepad ? pickControls(o.gamepad) : null] as const),
      ),
    );
  }

  /** `followGamepadPressed` over the controls `pickControls` picks from `options.gamepad` */
  public followGamepadPressed(
    gamepadInput: GamepadInput,
    pickControls: (gamepad: G) => GamepadControls | null | undefined,
  ): Observable<boolean> {
    return followGamepadPressed(gamepadInput, this.gamepadOption$(pickControls));
  }

  /**
   * `followGamepadDirection` over the direction `pickBinding` picks from `options.gamepad`, unbound
   * when `unbindOn$` next emits
   */
  public followGamepadDirection(
    gamepadInput: GamepadInput,
    direction: DirectionInput,
    pickBinding: (gamepad: G) => GamepadDirectionBinding | null | undefined,
  ): void {
    this.untilUnbound(followGamepadDirection(gamepadInput, direction, this.gamepadOption$(pickBinding)));
  }

  /**
   * Keeps `direction.keymap` at the keymap `pickKeymap` picks from `options`, now and after every
   * change, until `unbindOn$` next emits: how a controller's `DirectionInput` follows its
   * `options.keymap` through `setKeys`
   */
  public followKeymap(direction: DirectionInput, pickKeymap: (options: O) => DirectionKeymap | null): void {
    const subscription = this.option$(pickKeymap).subscribe(keymap => (direction.keymap = keymap));
    this.untilUnbound(() => subscription.unsubscribe());
  }

  private untilUnbound(unbind: () => void): void {
    this.unbindOn$.pipe(take(1)).subscribe(unbind);
  }

  /**
   * Copies the keys given (not the `undefined` ones) onto `options` and emits `'keys'`. The
   * `gamepad` binding is not a key: `setGamepad` writes it, so a `'keys'` change never stands for
   * a gamepad change (the touch layout of `@gg-web-engine/mobile-controls` rebuilds on `'keys'` only).
   */
  public setKeys(keys: Partial<Omit<O, 'gamepad'>>): void {
    const given = keys as Partial<O>;
    for (const name of Object.keys(given) as (keyof O)[]) {
      if (given[name] !== undefined) {
        this.options[name] = given[name] as O[keyof O];
      }
    }
    this._changed$.next('keys');
  }

  /**
   * Writes `options.gamepad`: `null` turns the gamepad off, a partial goes over the current binding
   * (over `defaultGamepad` while the gamepad is off or left out), its `undefined` controls left out
   * as `setKeys` leaves out `undefined` keys. Emits `'gamepad'` and returns the binding written.
   */
  public setGamepad(binding: Partial<G> | null): G | null {
    let next: G | null = null;
    if (binding !== null) {
      next = { ...(this.options.gamepad ?? this.defaultGamepad) };
      for (const name of Object.keys(binding) as (keyof G)[]) {
        if (binding[name] !== undefined) {
          next[name] = binding[name] as G[keyof G];
        }
      }
    }
    this.options.gamepad = next;
    this._changed$.next('gamepad');
    return next;
  }
}
