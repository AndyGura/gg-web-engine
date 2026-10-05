import { combineLatest, filter, Observable, Subject, takeUntil } from 'rxjs';
import { DirectionInput, DirectionKeymap, GgWorld, IEntity, KeyboardInput, TickOrder } from '../../../../base';

export type CarHandlingControllerOptions = {
  readonly keymap: DirectionKeymap;
  readonly maxSteerDeltaPerSecond: number;
};
export type CarHandlingOutput = { upDown: number; leftRight: number };

export class CarHandlingController extends IEntity {
  static readonly entityTypeName: string = 'CarHandlingController';
  public readonly tickOrder = TickOrder.INPUT_CONTROLLERS;

  public readonly directionsInput: DirectionInput;

  private _output$: Subject<CarHandlingOutput> = new Subject<CarHandlingOutput>();
  public get output$(): Observable<CarHandlingOutput> {
    return this._output$.asObservable();
  }

  constructor(
    public readonly keyboard: KeyboardInput,
    public readonly options: CarHandlingControllerOptions = {
      keymap: 'arrows',
      maxSteerDeltaPerSecond: 12,
    },
  ) {
    super();
    this.directionsInput = new DirectionInput(keyboard, options.keymap);
  }

  async onSpawned(world: GgWorld<any, any>): Promise<void> {
    super.onSpawned(world);
    let input: CarHandlingOutput = { upDown: 0, leftRight: 0 };
    combineLatest([this.directionsInput.direction$, this.tick$])
      .pipe(
        filter(() => this.active),
        takeUntil(this._onRemoved$),
      )
      .subscribe(([d, [_, dt]]) => {
        // `leftRight` is positive to the left, the opposite of `direction$`'s `x`
        const direction: CarHandlingOutput = { upDown: d.y, leftRight: d.x === 0 ? 0 : -d.x };
        if (direction.leftRight != input.leftRight) {
          let diff = Math.abs(direction.leftRight - input.leftRight);
          let maxSteerInputDelta = (this.options.maxSteerDeltaPerSecond * dt) / 1000;
          if (diff > maxSteerInputDelta) {
            if (direction.leftRight < input.leftRight) {
              direction.leftRight = input.leftRight - maxSteerInputDelta;
            } else {
              direction.leftRight = input.leftRight + maxSteerInputDelta;
            }
          }
        }
        input = direction;
      });
    this.tick$.pipe(takeUntil(this._onRemoved$)).subscribe(() => {
      this._output$.next(input);
    });
    await this.directionsInput.start();
  }

  async onRemoved(): Promise<void> {
    await super.onRemoved();
    await this.directionsInput.stop();
  }
}
