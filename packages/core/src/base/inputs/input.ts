import { Subject } from 'rxjs';

export abstract class Input<T extends any[] = [], K extends any[] = []> {
  private _running: boolean = false;
  protected readonly stop$: Subject<void> = new Subject<void>();
  public get running(): boolean {
    return this._running;
  }
  async start(...args: T): Promise<void> {
    if (this.running) {
      return;
    }
    await this.startInternal(...args);
    this._running = true;
  }

  async stop(...args: K): Promise<void> {
    if (!this.running) {
      return;
    }
    this.stop$.next();
    await this.stopInternal(...args);
    this._running = false;
  }

  protected abstract startInternal(...args: T): Promise<void>;
  protected async stopInternal(...args: K): Promise<void> {
  };
}
