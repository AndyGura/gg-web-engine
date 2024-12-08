import { Observable, Subject } from 'rxjs';

export abstract class IClock {
  protected readonly _tick$: Subject<[number, number]> = new Subject<[number, number]>();

  /**
   * Observable stream of ticks, emitting an array containing the current time and the tick delta.
   */
  public get tick$(): Observable<[number, number]> {
    return this._tick$.asObservable();
  }

  abstract get elapsedTime(): number;

  protected _children: IClock[] = [];

  public get children(): IClock[] {
    return [...this._children];
  }

  protected constructor(public readonly parent: IClock | null) {
    if (parent) {
      parent.addChild(this);
    }
  }

  public addChild(clock: IClock) {
    if (clock.parent !== this) {
      throw new Error('Incorrect child clock');
    }
    if (!this._children.includes(clock)) {
      this._children.push(clock);
    }
  }

  public removeChild(clock: IClock) {
    if (clock.parent !== this) {
      throw new Error('Incorrect child clock');
    }
    this._children = this._children.filter(c => c !== clock);
  }

  public dispose() {
    if (this.parent) {
      this.parent.removeChild(this);
    }
    for (const c of this._children) {
      c.dispose();
    }
    this._tick$.complete();
  }
}
