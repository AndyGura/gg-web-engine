import { Subject } from 'rxjs';

/**
 * An abstract class that provides basic implementation for Input class.
 * Input is an entity for handling input from user, such as mouse movements, key presses etc.
 * Inputs are not bound to World-s and working independently by design.
 *
 * TStartParams - A type representing an array of input arguments for the start method. Items are recommended to be named.
 *
 * TStopParams - A type representing an array of input arguments for the stop method. Items are recommended to be named.
 */
export abstract class Input<TStartParams extends any[] = [], TStopParams extends any[] = []> {
  /**
   * A private boolean that represents the running state of the process.
   */
  private _running: boolean = false;
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
    return this._running;
  }
  /**
   * An asynchronous method that starts the input. Do not override it
   * @param args - An array of input arguments for the start method.
   * @returns A Promise that resolves when the input is started.
   */
  async start(...args: TStartParams): Promise<void> {
    if (this.running) {
      return;
    }
    await this.startInternal(...args);
    this._running = true;
  }
  /**
   * An asynchronous method that stops the input. Do not override it
   * @param args - An array of input arguments for the stop method.
   * @returns A Promise that resolves when the input is stopped.
   */
  async stop(...args: TStopParams): Promise<void> {
    if (!this.running) {
      return;
    }
    this.stop$.next();
    await this.stopInternal(...args);
    this._running = false;
  }
  /**
   * An abstract asynchronous method that starts the input.
   * @param args - An array of input arguments for the start method.
   * @returns A Promise that resolves when the process is started.
   */
  protected abstract startInternal(...args: TStartParams): Promise<void>;
  /**
   * An asynchronous method that stops the input.
   * @param args - An array of input arguments for the stop method.
   * @returns A Promise that resolves when the process is stopped.
   */
  protected async stopInternal(...args: TStopParams): Promise<void> {}
}
