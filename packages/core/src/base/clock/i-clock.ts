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

  public get parent(): IClock | null {
    return this.parentClock;
  }

  protected _children: IClock[] = [];

  public get children(): IClock[] {
    return [...this._children];
  }

  protected constructor(protected readonly parentClock: IClock | null) {
    if (parentClock) {
      parentClock.addChild(this);
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
}
