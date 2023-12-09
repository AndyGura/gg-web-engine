import { combineLatest, Observable, Subject, takeUntil } from 'rxjs';
import {
  DirectionKeyboardInput,
  DirectionKeyboardKeymap,
  GgWorld,
  IEntity,
  KeyboardInput,
  TickOrder,
} from '../../../../base';

export type CarKeyboardControllerOptions = {
  readonly keymap: DirectionKeyboardKeymap;
  readonly maxSteerDeltaPerSecond: number;
};
export type CarHandlingOutput = { upDown: number; leftRight: number };

export class CarKeyboardHandlingController extends IEntity {
  public readonly tickOrder = TickOrder.INPUT_CONTROLLERS;

  protected readonly directionsInput: DirectionKeyboardInput;

  private _output$: Subject<CarHandlingOutput> = new Subject<CarHandlingOutput>();
  public get output$(): Observable<CarHandlingOutput> {
    return this._output$.asObservable();
  }

  constructor(
    protected readonly keyboard: KeyboardInput,
    protected readonly options: CarKeyboardControllerOptions = {
      keymap: 'arrows',
      maxSteerDeltaPerSecond: 12,
    },
  ) {
    super();
    this.directionsInput = new DirectionKeyboardInput(keyboard, options.keymap);
  }

  async onSpawned(world: GgWorld<any, any>): Promise<void> {
    super.onSpawned(world);
    let input: CarHandlingOutput = { upDown: 0, leftRight: 0 };
    combineLatest([this.directionsInput.output$, this.tick$])
      .pipe(takeUntil(this._onRemoved$))
      .subscribe(([d, [_, dt]]) => {
        const direction: CarHandlingOutput = { upDown: 0, leftRight: 0 };
        if (d.leftRight !== undefined) direction.leftRight = d.leftRight ? 1 : -1;
        if (d.upDown !== undefined) direction.upDown = d.upDown ? 1 : -1;
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
