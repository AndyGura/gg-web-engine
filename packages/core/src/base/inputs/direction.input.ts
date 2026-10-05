import { BehaviorSubject, combineLatest, Observable, Subject, takeUntil } from 'rxjs';
import { KeyboardInput } from './keyboard.input';
import { distinctUntilChanged, map } from 'rxjs/operators';
import { IInput } from './i-input';
import { Point2 } from '../models/points';
import { Pnt2 } from '../math/point2';

/**
 * Which keys a `DirectionInput` reads
 */
export type DirectionKeymap = 'arrows' | 'wasd' | 'wasd+arrows';

/**
 * The value of `DirectionInput.output$`: which way the direction keys point. An axis is `undefined`
 * while neither (or both) of its keys is held; `upDown` is `true` for up, `leftRight` for left
 */
export type DirectionKeyboardOutput = { upDown?: boolean; leftRight?: boolean };

/**
 * One analog contribution to a `DirectionInput`'s `direction$` - see
 * `DirectionInput.setAnalogDirection`. An omitted axis contributes nothing.
 */
export type AnalogDirection = { x?: number; y?: number };

const clampAxis = (value: number) => Math.max(-1, Math.min(1, value));

/**
 * An input for a direction, whatever device it comes from. `direction$` reports it as a vector,
 * combined from two kinds of sources:
 * - direction keys of a keyboard, in the two most popular layouts: WASD and arrows;
 * - analog contributions from anything else that can point in a direction (an on-screen stick, a
 *   tilt sensor, a gamepad), set through `setAnalogDirection`.
 *
 * Created without a keyboard or a keymap it takes analog contributions only.
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
   */
  constructor(
    protected readonly keyboard: KeyboardInput | null = null,
    protected readonly keymap: DirectionKeymap | null = 'wasd+arrows',
  ) {
    super();
  }

  /**
   * Called when the input handling should start.
   */
  protected startInternal() {
    if (!this.keyboard || !this.keymap) {
      return;
    }
    // Initialize an array to hold the keys to listen for
    const keys = [[], [], [], []] as string[][];
    // Add the "wasd" keys to the array if specified in the keymap
    if (this.keymap.includes('wasd')) {
      keys[0].push('KeyW');
      keys[1].push('KeyA');
      keys[2].push('KeyS');
      keys[3].push('KeyD');
    }
    // Add the arrow keys to the array if specified in the keymap
    if (this.keymap.includes('arrows')) {
      keys[0].push('ArrowUp');
      keys[1].push('ArrowLeft');
      keys[2].push('ArrowDown');
      keys[3].push('ArrowRight');
    }
    // Bind to the keyboard events for the specified keys
    combineLatest(keys.map(x => this.keyboard!.bindMany(...x)))
      .pipe(
        // Stop listening when the `stop$` signal is received
        takeUntil(this.stop$),
        // Map the key states to a `DirectionKeyboardOutput` object
        map(moveDirection => {
          const result: DirectionKeyboardOutput = {};
          if (moveDirection.includes(true)) {
            const [f, l, b, r] = moveDirection;
            if (f != b) result.upDown = f;
            if (l != r) result.leftRight = l;
          }
          return result;
        }),
      )
      // Emit the resulting `DirectionKeyboardOutput` object through the `_output$` subject
      .subscribe(o => {
        this.keysDirection = {
          x: o.leftRight === undefined ? 0 : o.leftRight ? -1 : 1,
          y: o.upDown === undefined ? 0 : o.upDown ? 1 : -1,
        };
        this.updateDirection();
        this._output$.next(o);
      });
  }

  protected stopInternal() {
    this.keysDirection = Pnt2.O;
    this.analogDirections.clear();
    this.updateDirection();
  }
}
