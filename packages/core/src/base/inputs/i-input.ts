import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { distinctUntilChanged } from 'rxjs/operators';

/**
 * An abstract class that provides basic implementation for Input class.
 * Input is an entity for handling input from user, such as mouse movements, key presses etc.
 * Inputs are not bound to World-s and working independently by design.
 *
 * TStartParams - A type representing an array of input arguments for the start method. Items are recommended to be named.
 *
 * TStopParams - A type representing an array of input arguments for the stop method. Items are recommended to be named.
 */
export abstract class IInput<TStartParams extends any[] = [], TStopParams extends any[] = []> {
  /**
   * The running state of the input.
   */
  private readonly _running$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
  /**
   * A protected subject that emits a void value when the process is stopped.
   * Subclasses, when subscribing to something using rxjs, have to add pipe takeUntil(this.stop$),
   * so everything will be unsubscribed when stopping input
   */
  protected readonly stop$: Subject<void> = new Subject<void>();
  /**
   * A public getter that returns the running state of the Input.
   */
  public get running(): boolean {
    return this._running$.getValue();
  }
  /**
   * Emits the running state on subscription and then every time the input starts or stops - after
   * `start` has set the input up, and after `stop` has released what it held. Something that feeds
   * the input on its own (an on-screen button held down) can apply its state again on a start.
   */
  public get running$(): Observable<boolean> {
    return this._running$.pipe(distinctUntilChanged());
  }
  /**
   * A method that starts the input. Do not override it
   * @param args - An array of input arguments for the start method.
   * @returns A Promise that resolves when the input is started.
   */
  start(...args: TStartParams): void {
    if (this.running) {
      return;
    }
    this.startInternal(...args);
    this._running$.next(true);
  }
  /**
   * A method that stops the input. Do not override it
   * @param args - An array of input arguments for the stop method.
   */
  stop(...args: TStopParams): void {
    if (!this.running) {
      return;
    }
    this.stop$.next();
    this.stopInternal(...args);
    this._running$.next(false);
  }
  /**
   * An abstract method that starts the input.
   * @param args - An array of input arguments for the start method.
   */
  protected abstract startInternal(...args: TStartParams): void;
  /**
   * A method that stops the input.
   * @param args - An array of input arguments for the stop method.
   * @returns A Promise that resolves when the process is stopped.
   */
  protected stopInternal(...args: TStopParams): void {}
}
