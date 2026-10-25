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
 * The value of `DirectionInput.output$`: which way the direction keys point. An axis is `undefined`
 * while neither of its keys is held, and while both are unless `DirectionOppositeKeys` makes one of
 * them win; `upDown` is `true` for up, `leftRight` for left
 */
export type DirectionKeyboardOutput = { upDown?: boolean; leftRight?: boolean };

/**
 * What a `DirectionInput` reads, per axis, while both opposite direction keys are held: `'cancel'`
 * (the default) for neither direction, or the direction that wins - a car whose brake overrides
 * the throttle, say (`{ upDown: 'down' }`). Releasing the winning key gives the other one back.
 */
export type DirectionOppositeKeys = {
  upDown?: 'cancel' | 'up' | 'down';
  leftRight?: 'cancel' | 'left' | 'right';
};

/** The options of a `DirectionInput` */
export type DirectionInputOptions = {
  /** What both opposite direction keys held give, per axis: neither direction by default */
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
 * combined from two kinds of sources:
 * - direction keys of a keyboard: WASD, arrows, or any codes per direction (`keymap`, which can be
 *   changed while the input runs);
 * - analog contributions from anything else that can point in a direction (an on-screen stick, a
 *   tilt sensor, a gamepad), set through `setAnalogDirection`.
 *
 * Created without a keyboard or a keymap it takes analog contributions only. Both keys of an axis
 * held (up and down, left and right) cancel each other out, unless `oppositeKeys` makes one win.
 */
export class DirectionInput extends IInput {
  /**
   * A subject that emits `DirectionKeyboardOutput` objects whenever the direction keys change.
   */
  private _output$: Subject<DirectionKeyboardOutput> = new Subject<DirectionKeyboardOutput>();

  /**
   * Returns an observable that emits `DirectionKeyboardOutput` objects whenever the input changes.
   */
  public get output$(): Observable<DirectionKeyboardOutput> {
    return this._output$.asObservable();
  }

  private readonly _direction$: BehaviorSubject<Point2> = new BehaviorSubject<Point2>(Pnt2.O);
  private keysDirection: Point2 = Pnt2.O;
  private readonly analogDirections: Map<unknown, AnalogDirection> = new Map<unknown, AnalogDirection>();
  private keysSubscription: Subscription | null = null;
  /** The keys held while bound: up, left, down, right; `null` while unbound */
  private heldKeys: readonly boolean[] | null = null;
  private keysOutput: DirectionKeyboardOutput = {};
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
      // one `{}` on `output$` for the rebind: the new bindings' first emission, or, with no keys to
      // bind, the release of the old ones
      const wasBound = this.unbindKeys(false);
      if (!this.bindKeys() && wasBound) {
        this._output$.next({});
      }
    }
  }

  /**
   * What both opposite direction keys held give, per axis: `'cancel'` (or the axis left out) for
   * neither direction, or the direction that wins. Assigning it while the input runs applies at
   * once to the keys already held, reporting the change on `output$` and `direction$`. Applies to
   * the keys only: analog contributions are summed as ever.
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
    if (this.heldKeys) {
      const before = this.keysOutput;
      const after = this.keysOutputOf(this.heldKeys);
      if (before.upDown !== after.upDown || before.leftRight !== after.leftRight) {
        this.applyKeysOutput(after);
      }
    }
  }

  /**
   * The current direction as a vector: `x` from -1 (left) to 1 (right), `y` from -1 (down/backward)
   * to 1 (up/forward). The held keys (each worth a full -1/1) and every analog contribution are
   * summed and each axis is clamped to [-1, 1] on its own, so the vector may be longer than 1 on a
   * diagonal. Emits the current value on subscription and then on every change.
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

  private updateDirection(): void {
    let { x, y } = this.keysDirection;
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
    // the contributions go first, so that `direction$` goes straight to zero: `unbindKeys` reports
    // the direction, and would otherwise report the contributions alone on the way
    this.analogDirections.clear();
    this.unbindKeys();
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
      this.applyKeysOutput(this.keysOutputOf(held));
    });
    return true;
  }

  /** The `DirectionKeyboardOutput` of the keys held (up, left, down, right) */
  private keysOutputOf([up, left, down, right]: readonly boolean[]): DirectionKeyboardOutput {
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

  /** Makes `o` the keys' share of `direction$` and reports it on `output$` */
  private applyKeysOutput(o: DirectionKeyboardOutput): void {
    this.keysOutput = o;
    this.keysDirection = {
      x: o.leftRight === undefined ? 0 : o.leftRight ? -1 : 1,
      y: o.upDown === undefined ? 0 : o.upDown ? 1 : -1,
    };
    this.updateDirection();
    this._output$.next(o);
  }

  /** Unbinds the keys, reporting `{}` on `output$` (nothing is held any more, as releasing every key would) unless told not to; whether any were bound */
  private unbindKeys(report: boolean = true): boolean {
    const wasBound = !!this.keysSubscription;
    if (this.keysSubscription) {
      this.keysSubscription.unsubscribe();
      this.keysSubscription = null;
      this.heldKeys = null;
      this.keysOutput = {};
      if (report) {
        this._output$.next({});
      }
    }
    this.keysDirection = Pnt2.O;
    this.updateDirection();
    return wasBound;
  }
}
