import { BehaviorSubject, Observable } from 'rxjs';
import { distinctUntilChanged } from 'rxjs/operators';
import { IInput } from '@gg-web-engine/core';

export type TiltInputOptions = {
  /** The tilt, in degrees, that reads as full deflection. 30 by default. */
  maxAngle: number;
  /** The tilt, in degrees, around level that reads as zero. 2 by default. */
  deadzone: number;
  /** Flips the sign of the output. `false` by default. */
  invert: boolean;
};

const DEFAULT_OPTIONS: TiltInputOptions = { maxAngle: 30, deadzone: 2, invert: false };

/**
 * An input reading how the device is tilted sideways, like a steering wheel: `value$` goes from -1
 * (the left edge of the screen is the lower one) to 1 (the right edge is), whichever way the screen
 * is currently rotated and whether the device is held upright or lies flat.
 *
 * Orientation data is available to pages served over https (or from localhost) only; anywhere else
 * `permission$` reports `'denied'`.
 *
 * Some browsers (iOS Safari) only hand out orientation data after the user allowed it in a prompt
 * that has to be opened from a user gesture. `start()` takes care of that: when a permission is
 * needed, it asks on the next tap anywhere on the page and starts reporting once granted.
 * `permission$` tells how that went, for an app that wants to explain itself first or to fall back
 * to another control when denied.
 */
export class TiltInput extends IInput {
  /** Whether the browser reports device orientation at all. */
  static isSupported(): boolean {
    return typeof window !== 'undefined' && 'DeviceOrientationEvent' in window;
  }

  public readonly options: TiltInputOptions;

  private readonly _value$: BehaviorSubject<number> = new BehaviorSubject<number>(0);
  private readonly _permission$: BehaviorSubject<'unknown' | 'granted' | 'denied'> = new BehaviorSubject<
    'unknown' | 'granted' | 'denied'
  >('unknown');

  /** Emits the current value on subscription and then every change. */
  public get value$(): Observable<number> {
    return this._value$.pipe(distinctUntilChanged());
  }

  public get value(): number {
    return this._value$.getValue();
  }

  public get permission$(): Observable<'unknown' | 'granted' | 'denied'> {
    return this._permission$.pipe(distinctUntilChanged());
  }

  constructor(options: Partial<TiltInputOptions> = {}) {
    super();
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.handleOrientation = this.handleOrientation.bind(this);
    this.requestPermission = this.requestPermission.bind(this);
  }

  protected startInternal(): void {
    if (!TiltInput.isSupported()) {
      this._permission$.next('denied');
      return;
    }
    if (window.isSecureContext === false) {
      // browsers hand out orientation data to pages served over https (or from localhost) only, and
      // on other pages stay silent instead of failing
      console.warn('[TiltInput] device orientation is not available: the page is not served over https');
      this._permission$.next('denied');
      return;
    }
    const needsPermission = typeof (DeviceOrientationEvent as any).requestPermission === 'function';
    if (needsPermission && this._permission$.getValue() !== 'granted') {
      // the prompt only opens from a handler of a finished gesture, not from a touch going down
      window.addEventListener('touchend', this.requestPermission);
      window.addEventListener('click', this.requestPermission);
    } else {
      this._permission$.next('granted');
      window.addEventListener('deviceorientation', this.handleOrientation);
    }
  }

  protected stopInternal(): void {
    window.removeEventListener('touchend', this.requestPermission);
    window.removeEventListener('click', this.requestPermission);
    window.removeEventListener('deviceorientation', this.handleOrientation);
    this._value$.next(0);
  }

  private requestPermission(): void {
    window.removeEventListener('touchend', this.requestPermission);
    window.removeEventListener('click', this.requestPermission);
    (DeviceOrientationEvent as any)
      .requestPermission()
      .then((state: string) => {
        this._permission$.next(state === 'granted' ? 'granted' : 'denied');
        if (state === 'granted' && this.running) {
          window.addEventListener('deviceorientation', this.handleOrientation);
        }
      })
      .catch(() => this._permission$.next('denied'));
  }

  private handleOrientation(event: DeviceOrientationEvent): void {
    if (event.beta === null || event.gamma === null) {
      return;
    }
    const beta = (event.beta * Math.PI) / 180;
    const gamma = (event.gamma * Math.PI) / 180;
    // the direction of gravity within the plane of the screen, in the device's own (portrait) axes:
    // x towards its right edge, y towards its top edge
    const gravityX = Math.cos(beta) * Math.sin(gamma);
    const gravityY = -Math.sin(beta);
    // how much of it points towards the right edge of the screen as currently rotated
    const screenAngle = ((screen.orientation?.angle ?? (window as any).orientation ?? 0) * Math.PI) / 180;
    const right = gravityX * Math.cos(screenAngle) - gravityY * Math.sin(screenAngle);
    const degrees = (Math.asin(Math.max(-1, Math.min(1, right))) * 180) / Math.PI;
    const { maxAngle, deadzone, invert } = this.options;
    let value = 0;
    if (Math.abs(degrees) > deadzone) {
      value = Math.sign(degrees) * Math.min(1, (Math.abs(degrees) - deadzone) / (maxAngle - deadzone));
    }
    this._value$.next(invert && value !== 0 ? -value : value);
  }
}
