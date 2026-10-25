import { BehaviorSubject, combineLatest, Observable, of, Subject, Subscription } from 'rxjs';
import { KeyboardInput } from './keyboard.input';
import { distinctUntilChanged } from 'rxjs/operators';
import { IInput } from './i-input';
import { Point2 } from '../models/points';
import { Pnt2 } from '../math/point2';

/**
 * Custom direction keys: `KeyboardEvent.code` values per direction (`'KeyW'`, `'ArrowUp'`,
 * `'Numpad8'`), one code or a list of codes that each move that way. A direction with no codes is
 * never pushed by a key.
 */
export type DirectionKeyCodes = {
  up: string | readonly string[];
  down: string | readonly string[];
  left: string | readonly string[];
  right: string | readonly string[];
};

/**
 * Which keys a `DirectionInput` reads: one of the two most popular layouts, both of them, or
 * custom codes per direction (for a controls menu letting the player rebind them)
 */
export type DirectionKeymap = 'arrows' | 'wasd' | 'wasd+arrows' | DirectionKeyCodes;

const asCodeList = (codes: string | readonly string[]): string[] => (typeof codes === 'string' ? [codes] : [...codes]);

/** One of the four directions of a `DirectionInput` */
export type DirectionName = keyof DirectionKeyCodes;

/** The directions in the order `DirectionInput` keeps their held states */
const DIRECTIONS: readonly DirectionName[] = ['up', 'left', 'down', 'right'];

/**
 * The key codes a `DirectionKeymap` stands for, each direction as a list (a copy, never the
 * keymap's own arrays)
 */
export function directionKeyCodes(keymap: DirectionKeymap): {
  up: string[];
  down: string[];
  left: string[];
  right: string[];
} {
  if (typeof keymap !== 'string') {
    return {
      up: asCodeList(keymap.up),
      down: asCodeList(keymap.down),
      left: asCodeList(keymap.left),
      right: asCodeList(keymap.right),
    };
  }
  const result = { up: [] as string[], down: [] as string[], left: [] as string[], right: [] as string[] };
  if (keymap.includes('wasd')) {
    result.up.push('KeyW');
    result.left.push('KeyA');
    result.down.push('KeyS');
    result.right.push('KeyD');
  }
  if (keymap.includes('arrows')) {
    result.up.push('ArrowUp');
    result.left.push('ArrowLeft');
    result.down.push('ArrowDown');
    result.right.push('ArrowRight');
  }
  return result;
}

/**
 * The value of `DirectionInput.output$`: which way the held directions point - the direction keys
 * and the directions pressed through `DirectionInput.pressDirection`. An axis is `undefined` while
 * neither of its directions is held, and while both are unless `DirectionOppositeKeys` makes one of
 * them win; `upDown` is `true` for up, `leftRight` for left
 */
export type DirectionKeyboardOutput = { upDown?: boolean; leftRight?: boolean };

/**
 * What a `DirectionInput` reads, per axis, while both opposite directions are held - by keys or
 * by `DirectionInput.pressDirection` (on-screen buttons), in any mix: `'cancel'` (the default) for
 * neither direction, or the direction that wins - a car whose brake overrides the throttle, say
 * (`{ upDown: 'down' }`). Releasing the winning direction gives the other one back. Analog
 * contributions (sticks, tilt, a gamepad) are summed whatever it says.
 */
export type DirectionOppositeKeys = {
  upDown?: 'cancel' | 'up' | 'down';
  leftRight?: 'cancel' | 'left' | 'right';
};

/** The options of a `DirectionInput` */
export type DirectionInputOptions = {
  /** What both opposite directions held give, per axis: neither direction by default */
  oppositeKeys?: DirectionOppositeKeys;
};

/**
 * One analog contribution to a `DirectionInput`'s `direction$` - see
 * `DirectionInput.setAnalogDirection`. An omitted axis contributes nothing.
 */
export type AnalogDirection = { x?: number; y?: number };

const clampAxis = (value: number) => Math.max(-1, Math.min(1, value));

/**
 * One axis of a `DirectionKeyboardOutput` from its two keys: `true` for the first, `false` for the
 * second, `undefined` for neither; with both held, `winner` decides (`undefined` to cancel)
 */
const resolveAxis = (first: boolean, second: boolean, winner: boolean | undefined): boolean | undefined =>
  first && second ? winner : first != second ? first : undefined;

/** Whether two keymaps stand for the same codes per direction, in whatever order */
const sameKeymap = (a: DirectionKeymap | null, b: DirectionKeymap | null): boolean => {
  if (a === b) {
    return true;
  }
  if (!a || !b) {
    return false;
  }
  const codesA = directionKeyCodes(a);
  const codesB = directionKeyCodes(b);
  const sorted = (codes: readonly string[]) => [...codes].sort().join(' ');
  return (['up', 'down', 'left', 'right'] as const).every(d => sorted(codesA[d]) === sorted(codesB[d]));
};

/**
 * An input for a direction, whatever device it comes from. `direction$` reports it as a vector,
 * combined from three kinds of sources:
 * - direction keys of a keyboard: WASD, arrows, or any codes per direction (`keymap`, which can be
 *   changed while the input runs);
 * - held directions from anything else that is either pushed or not (an on-screen button), set
 *   through `pressDirection`/`releaseDirection` - a held direction counts as one more key;
 * - analog contributions from anything else that can point in a direction (an on-screen stick, a
 *   tilt sensor, a gamepad), set through `setAnalogDirection`.
 *
 * Created without a keyboard or a keymap it takes held directions and analog contributions only.
 * Both directions of an axis held (up and down, left and right), by keys or pressed directions,
 * cancel each other out, unless `oppositeKeys` makes one win; analog contributions are summed.
 */
export class DirectionInput extends IInput {
  /**
   * A subject that emits `DirectionKeyboardOutput` objects whenever the held directions change.
   */
  private _output$: Subject<DirectionKeyboardOutput> = new Subject<DirectionKeyboardOutput>();

  /**
   * Emits a `DirectionKeyboardOutput` whenever the held directions - keys and pressed directions -
   * change. Analog contributions are not part of it.
   */
  public get output$(): Observable<DirectionKeyboardOutput> {
    return this._output$.asObservable();
  }

  private readonly _direction$: BehaviorSubject<Point2> = new BehaviorSubject<Point2>(Pnt2.O);
  /** The held directions' share of `direction$` */
  private heldDirection: Point2 = Pnt2.O;
  private readonly analogDirections: Map<unknown, AnalogDirection> = new Map<unknown, AnalogDirection>();
  /** The holders of every direction pressed through `pressDirection` */
  private readonly pressedDirections: Map<DirectionName, Set<unknown>> = new Map<DirectionName, Set<unknown>>();
  private keysSubscription: Subscription | null = null;
  /** The keys held while bound: up, left, down, right; `null` while unbound */
  private heldKeys: readonly boolean[] | null = null;
  private heldOutput: DirectionKeyboardOutput = {};
  private _keymap: DirectionKeymap | null;
  private _oppositeKeys: DirectionOppositeKeys;

  /**
   * The keys this input reads, `null` for none. Assigning it while the input runs rebinds the keys
   * at once: the keys of the old keymap stop counting, and a key of the new one that is already
   * held counts from its next press. A keymap standing for the same codes as the current one
   * (`'wasd'` over its own codes spelled out) rebinds nothing, so a held key stays held. A built-in
   * controller's direction input is rebound through the controller's `setKeys({ keymap })` instead,
   * which keeps its `options` in step.
   *
   * @example
   * ```ts
   * // a controls menu rebinding a direction input of the app's own
   * moveInput.keymap = { up: 'KeyI', down: 'KeyK', left: 'KeyJ', right: 'KeyL' };
   * ```
   */
  public get keymap(): DirectionKeymap | null {
    return this._keymap;
  }

  public set keymap(value: DirectionKeymap | null) {
    const same = sameKeymap(value, this._keymap);
    this._keymap = value;
    if (this.running && !same) {
      // one emission on `output$` for the rebind: the new bindings' first one, or, with no keys to
      // bind, the release of the old ones
      const wasBound = this.unbindKeys(false);
      if (!this.bindKeys() && wasBound) {
        this._output$.next(this.heldOutput);
      }
    }
  }

  /**
   * What both opposite directions held give, per axis: `'cancel'` (or the axis left out) for
   * neither direction, or the direction that wins. It decides the keys and the pressed directions
   * alike: with `{ upDown: 'down' }`, an on-screen brake button overrides the throttle key or
   * button. Assigning it while the input runs applies at once to what is already held, reporting the
   * change on `output$` and `direction$`. Analog contributions are summed whatever it says.
   *
   * @example
   * ```ts
   * // throttle and brake held together brake
   * pedals.oppositeKeys = { upDown: 'down' };
   * ```
   */
  public get oppositeKeys(): DirectionOppositeKeys {
    return this._oppositeKeys;
  }

  public set oppositeKeys(value: DirectionOppositeKeys) {
    this._oppositeKeys = { ...value };
    const before = this.heldOutput;
    const after = this.outputOf(this.held());
    if (before.upDown !== after.upDown || before.leftRight !== after.leftRight) {
      this.applyHeld(true);
    }
  }

  /**
   * The current direction as a vector: `x` from -1 (left) to 1 (right), `y` from -1 (down/backward)
   * to 1 (up/forward). The held directions (keys and pressed directions, each axis worth a full
   * -1/1 as `oppositeKeys` resolves it) and every analog contribution are summed and each axis is
   * clamped to [-1, 1] on its own, so the vector may be longer than 1 on a diagonal. Emits the
   * current value on subscription and then on every change.
   */
  public get direction$(): Observable<Point2> {
    return this._direction$.pipe(distinctUntilChanged((a, b) => a.x === b.x && a.y === b.y));
  }

  /**
   * The current value of `direction$`.
   */
  public get direction(): Point2 {
    return this._direction$.getValue();
  }

  /**
   * Sets (or, with `null`, withdraws) one source's analog contribution to `direction$`. `source` is
   * any value identifying the caller, typically the object doing the call: every source has one
   * contribution, replaced by its next call. Ignored while the input is not running; stopping the
   * input withdraws every contribution.
   */
  public setAnalogDirection(source: unknown, value: AnalogDirection | null): void {
    if (!this.running) {
      return;
    }
    if (value === null) {
      this.analogDirections.delete(source);
    } else {
      this.analogDirections.set(source, value);
    }
    this.updateDirection();
  }

  /**
   * Holds `direction` on behalf of `holder` (any value identifying the caller, typically the object
   * doing the call), the way a held key does: it counts with the keys towards `output$` and
   * `direction$`, and `oppositeKeys` decides it together with them - for anything that is either
   * pushed or not, like an on-screen button. A direction is held while any holder (or key) holds it;
   * pressing it again by the same holder changes nothing. Ignored while the input is not running;
   * stopping the input releases every pressed direction.
   *
   * @example
   * ```ts
   * brakeButton.onPress(() => pedals.pressDirection('down', brakeButton));
   * brakeButton.onRelease(() => pedals.releaseDirection('down', brakeButton));
   * ```
   */
  public pressDirection(direction: DirectionName, holder: unknown): void {
    if (!this.running) {
      return;
    }
    let holders = this.pressedDirections.get(direction);
    if (!holders) {
      holders = new Set<unknown>();
      this.pressedDirections.set(direction, holders);
    }
    if (!holders.has(holder)) {
      holders.add(holder);
      this.applyHeld(true);
    }
  }

  /** Releases `holder`'s hold of `direction` (see `pressDirection`); nothing if it holds none */
  public releaseDirection(direction: DirectionName, holder: unknown): void {
    const holders = this.pressedDirections.get(direction);
    if (holders?.delete(holder)) {
      if (holders.size === 0) {
        this.pressedDirections.delete(direction);
      }
      this.applyHeld(true);
    }
  }

  private updateDirection(): void {
    let { x, y } = this.heldDirection;
    for (const value of this.analogDirections.values()) {
      x += value.x || 0;
      y += value.y || 0;
    }
    this._direction$.next({ x: clampAxis(x), y: clampAxis(y) });
  }

  /**
   * Creates a new instance of the `DirectionInput` class.
   *
   * @param keyboard The `KeyboardInput` instance to read direction keys from, normally the world's one. `null` for no keys
   * @param keymap The `DirectionKeymap` defining which keys to listen for. `null` for no keys
   * @param options `oppositeKeys`: what both opposite direction keys held give (see `oppositeKeys`)
   */
  constructor(
    protected readonly keyboard: KeyboardInput | null = null,
    keymap: DirectionKeymap | null = 'wasd+arrows',
    options: DirectionInputOptions = {},
  ) {
    super();
    this._keymap = keymap;
    this._oppositeKeys = { ...options.oppositeKeys };
  }

  /**
   * Called when the input handling should start.
   */
  protected startInternal() {
    this.bindKeys();
  }

  protected stopInternal() {
    // the contributions and pressed directions go first, so that `direction$` and `output$` go
    // straight to zero: `unbindKeys` reports them, and would otherwise report those alone on the way
    this.analogDirections.clear();
    const pressed = this.pressedDirections.size > 0;
    this.pressedDirections.clear();
    if (!this.unbindKeys() && pressed) {
      this._output$.next({});
    }
  }

  /** Binds the keymap's keys, emitting their state on `output$` at once; `false` with none to bind */
  private bindKeys(): boolean {
    if (!this.keyboard || !this._keymap) {
      return false;
    }
    const keyboard = this.keyboard;
    const { up, left, down, right } = directionKeyCodes(this._keymap);
    this.keysSubscription = combineLatest(
      // a direction without keys is never held
      [up, left, down, right].map(codes => (codes.length > 0 ? keyboard.bindMany(...codes) : of(false))),
    ).subscribe(held => {
      this.heldKeys = held;
      this.applyHeld(true);
    });
    return true;
  }

  /** Whether each direction (up, left, down, right) is held, by a key or a pressed direction */
  private held(): boolean[] {
    return DIRECTIONS.map((d, i) => !!this.heldKeys?.[i] || this.pressedDirections.has(d));
  }

  /** The `DirectionKeyboardOutput` of the directions held (up, left, down, right) */
  private outputOf([up, left, down, right]: readonly boolean[]): DirectionKeyboardOutput {
    const { upDown, leftRight } = this._oppositeKeys;
    const result: DirectionKeyboardOutput = {};
    const vertical = resolveAxis(up, down, upDown === 'up' ? true : upDown === 'down' ? false : undefined);
    const horizontal = resolveAxis(
      left,
      right,
      leftRight === 'left' ? true : leftRight === 'right' ? false : undefined,
    );
    if (vertical !== undefined) result.upDown = vertical;
    if (horizontal !== undefined) result.leftRight = horizontal;
    return result;
  }

  /** Makes what is held now the held directions' share of `direction$`, reporting it on `output$` if told to */
  private applyHeld(report: boolean): void {
    const o = this.outputOf(this.held());
    this.heldOutput = o;
    this.heldDirection = {
      x: o.leftRight === undefined ? 0 : o.leftRight ? -1 : 1,
      y: o.upDown === undefined ? 0 : o.upDown ? 1 : -1,
    };
    this.updateDirection();
    if (report) {
      this._output$.next(o);
    }
  }

  /**
   * Unbinds the keys, reporting what is still held on `output$` (as releasing every key would)
   * unless told not to; whether any were bound
   */
  private unbindKeys(report: boolean = true): boolean {
    const wasBound = !!this.keysSubscription;
    if (this.keysSubscription) {
      this.keysSubscription.unsubscribe();
      this.keysSubscription = null;
      this.heldKeys = null;
    }
    this.applyHeld(wasBound && report);
    return wasBound;
  }
}
