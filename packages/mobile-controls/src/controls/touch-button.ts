import { BehaviorSubject, Observable, skip, takeUntil } from 'rxjs';
import { distinctUntilChanged, filter } from 'rxjs/operators';
import { AnalogDirection, DirectionInput, KeyboardInput } from '@gg-web-engine/core';
import { TouchControl, TouchControlOptions } from './touch-control';

export type TouchButtonOptions = TouchControlOptions & {
  /** What the button shows: markup (an inline SVG, plain text) or a DOM node. */
  content?: string | Node;
  /**
   * `'hold'` (default): pressed while a finger is on it. `'toggle'`: every tap flips it, for an
   * action that would otherwise need a finger parked on the button (sprint, crouch).
   */
  mode?: 'hold' | 'toggle';
};

/**
 * An on-screen button. Read it through `pressed$`, or bind it to what a key already does with
 * `bindKey`, so anything an app maps to its keyboard gets a touch button without further code.
 */
export class TouchButton extends TouchControl {
  public readonly mode: 'hold' | 'toggle';

  private readonly _pressed$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);

  /** Emits the current state on subscription and then every change; completes on `dispose`. */
  public get pressed$(): Observable<boolean> {
    return this._pressed$.pipe(distinctUntilChanged(), takeUntil(this.disposed$));
  }

  public get pressed(): boolean {
    return this._pressed$.getValue();
  }

  /** Settable, e.g. to bring a toggle button in line with a state that changed by other means. */
  public set pressed(value: boolean) {
    if (this.disposed || value === this.pressed) {
      return;
    }
    this.element.classList.toggle('gg-mc-active', value);
    this.element.setAttribute('aria-pressed', `${value}`);
    this._pressed$.next(value);
  }

  constructor(options: TouchButtonOptions = {}) {
    super('button', options);
    this.mode = options.mode || 'hold';
    this.element.setAttribute('role', 'button');
    this.setContent(options.content ?? '');
  }

  public setContent(content: string | Node): void {
    if (typeof content === 'string') {
      this.element.innerHTML = content;
    } else {
      this.element.replaceChildren(content);
    }
  }

  /**
   * Makes the button act as the key `code` of `keyboard`: pressing it is that key going down,
   * releasing it the key going up.
   */
  public bindKey(keyboard: KeyboardInput, code: string): this {
    this.changes$.subscribe(pressed => (pressed ? keyboard.emulateKeyDown(code) : keyboard.emulateKeyUp(code)));
    return this;
  }

  /**
   * Makes the button push `input` in a direction while pressed, e.g. `{ x: -1 }` for "left".
   */
  public bindDirection(input: DirectionInput, value: AnalogDirection): this {
    this.changes$.subscribe(pressed => input.setAnalogDirection(this, pressed ? value : null));
    return this;
  }

  /** Calls `callback` every time the button becomes pressed. */
  public onPress(callback: () => void): this {
    this.changes$.pipe(filter(pressed => pressed)).subscribe(() => callback());
    return this;
  }

  /** Calls `callback` every time the button stops being pressed. */
  public onRelease(callback: () => void): this {
    this.changes$.pipe(filter(pressed => !pressed)).subscribe(() => callback());
    return this;
  }

  public reset(): void {
    super.reset();
    this.pressed = false;
  }

  /** `pressed$` without the value it replays on subscription. */
  private get changes$(): Observable<boolean> {
    return this.pressed$.pipe(skip(1));
  }

  protected onPointerStart(): void {
    this.pressed = this.mode === 'toggle' ? !this.pressed : true;
  }

  protected onPointerEnd(): void {
    if (this.mode === 'hold') {
      this.pressed = false;
    }
  }
}
