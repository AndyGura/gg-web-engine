import { BehaviorSubject, Observable, takeUntil } from 'rxjs';
import { distinctUntilChanged } from 'rxjs/operators';
import { DirectionInput, KeyboardInput, MouseInput, Pnt2, Point2 } from '@gg-web-engine/core';
import { TouchControl, TouchControlOptions } from './touch-control';

/** The key codes a `TouchAxisControl` presses for each direction - see `bindKeys`. */
export type AxisKeys = { up?: string; down?: string; left?: string; right?: string };

/**
 * The base of the controls that point in a direction (`TouchStick`, `TouchDPad`). `value$` is a
 * vector with `x` from -1 (left) to 1 (right) and `y` from -1 (down) to 1 (up), never longer than 1 -
 * the same convention as `DirectionInput.direction$`.
 */
export abstract class TouchAxisControl extends TouchControl {
  private readonly _value$: BehaviorSubject<Point2> = new BehaviorSubject<Point2>(Pnt2.O);

  /** Emits the current value on subscription and then every change; completes on `dispose`. */
  public get value$(): Observable<Point2> {
    return this._value$.pipe(
      distinctUntilChanged((a, b) => a.x === b.x && a.y === b.y),
      takeUntil(this.disposed$),
    );
  }

  public get value(): Point2 {
    return this._value$.getValue();
  }

  protected constructor(kind: string, options: TouchControlOptions) {
    super(kind, options);
  }

  protected setValue(value: Point2): void {
    if (!this.disposed) {
      this._value$.next(value);
    }
  }

  /**
   * Feeds the control into `input` as an analog direction, which every built-in controller moving by
   * direction keys (car, character, free camera) follows proportionally.
   */
  public bindDirection(input: DirectionInput): this {
    this.value$.subscribe(v => input.setAnalogDirection(this, v.x === 0 && v.y === 0 ? null : v));
    return this;
  }

  /**
   * Makes the control hold a key of `keyboard` down per direction while it points that way further
   * than `threshold` - for anything that only understands keys.
   */
  public bindKeys(keyboard: KeyboardInput, keys: AxisKeys, threshold: number = 0.5): this {
    const held: { [code: string]: boolean } = {};
    const set = (code: string | undefined, down: boolean) => {
      if (!code || !!held[code] === down) {
        return;
      }
      held[code] = down;
      down ? keyboard.emulateKeyDown(code) : keyboard.emulateKeyUp(code);
    };
    this.value$.subscribe(v => {
      set(keys.up, v.y > threshold);
      set(keys.down, v.y < -threshold);
      set(keys.left, v.x < -threshold);
      set(keys.right, v.x > threshold);
    });
    return this;
  }

  /**
   * Makes the control turn a view the way a mouse does: while it is deflected, `mouse` reports a
   * continuous movement of up to `speed` pixels per second in that direction.
   */
  public bindLook(mouse: MouseInput, speed: number = 900): this {
    let frame: number | null = null;
    let last = 0;
    const step = (time: number) => {
      frame = null;
      const { x, y } = this.value;
      if (this.disposed || (x === 0 && y === 0)) {
        return;
      }
      // the first frame's timestamp is its start time, which may precede the moment `last` was taken
      const dt = Math.max(0, Math.min(100, time - last)) / 1000;
      last = time;
      // the pointer's y grows downwards, the control's upwards
      mouse.emulateMove({ x: x * speed * dt, y: -y * speed * dt });
      frame = requestAnimationFrame(step);
    };
    this.value$.subscribe({
      next: v => {
        if (frame === null && (v.x !== 0 || v.y !== 0)) {
          last = performance.now();
          frame = requestAnimationFrame(step);
        }
      },
      complete: () => {
        if (frame !== null) {
          cancelAnimationFrame(frame);
        }
      },
    });
    return this;
  }
}
