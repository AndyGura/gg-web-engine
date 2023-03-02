import { BehaviorSubject, combineLatest, interval, pipe, Subject, takeUntil, filter } from 'rxjs';
import { distinctUntilChanged, map, pairwise, startWith, switchMap, take, tap } from 'rxjs/operators';
import { IController } from '../../base/controllers/i-controller';
import { KeyboardController } from '../../base/controllers/keyboard.controller';
import { Gg3dRaycastVehicleEntity } from '../entities/gg-3d-raycast-vehicle.entity';
import { bindDirectionKeys, DirectionKeymap, DirectionOutput } from '../../base/controllers/common';

// TODO pass as settings
// TODO smooth y?
const TICKER_INTERVAL = 16;
const TICKER_MAX_STEPS = 10;

type CarKeyboardControllerOptions = {
  keymap: DirectionKeymap;
  gearUpDownKeys: [string, string],
}

export class CarKeyboardController implements IController {

  // emits values -1 - 1; -1 = full turn left; 1 = full turn right
  private readonly x$: BehaviorSubject<number> = new BehaviorSubject<number>(0);
  // emits values -1 - 1; -1 = full brake; 1 = full acceleration
  private readonly y$: BehaviorSubject<number> = new BehaviorSubject<number>(0);

  private lastX: number = 0;
  private readonly stop$: Subject<void> = new Subject<void>();

  pairTickerPipe = pipe(
    startWith(0),
    pairwise<number>(),
    map(([beforeValue, afterValue]) => ([this.lastX, afterValue] as [number, number])),
    switchMap(
      ([beforeValue, afterValue]: [number, number]) => (
        interval(TICKER_INTERVAL).pipe(
          take(TICKER_MAX_STEPS),
          map(count => ++count),
          map(count =>
            beforeValue * ((TICKER_MAX_STEPS - count) / TICKER_MAX_STEPS) + afterValue * (count / TICKER_MAX_STEPS)
          ),
          tap(x => {
            this.lastX = x;
          }),
        )
      )
    ));

  constructor(
    private readonly keyboardController: KeyboardController,
    private readonly car: Gg3dRaycastVehicleEntity,
    private readonly options: CarKeyboardControllerOptions = { keymap: 'arrows', gearUpDownKeys: ['KeyA', 'KeyZ'] },
  ) {
  }

  async start(): Promise<void> {
    let moveDirection: DirectionOutput = {};
    bindDirectionKeys(this.keyboardController, this.options.keymap)
      .pipe(takeUntil(this.stop$))
      .subscribe((d) => {
        moveDirection = d;
      });
    this.car.tick$
      .pipe(
        takeUntil(this.stop$),
        map(() => {
          const direction = [0, 0];
          if (moveDirection.leftRight !== undefined) direction[0] = moveDirection.leftRight ? -1 : 1;
          if (moveDirection.upDown !== undefined) direction[1] = moveDirection.upDown ? 1 : -1;
          return direction;
        }),
      )
      .subscribe(([x, y]) => {
        this.x$.next(x);
        this.y$.next(y);
      });
    combineLatest([
      this.x$.pipe(
        takeUntil(this.stop$),
        distinctUntilChanged(),
        this.pairTickerPipe,
      ),
      this.y$.pipe(
        takeUntil(this.stop$),
        distinctUntilChanged()
      ),
    ]).subscribe(([x, y]) => {
      this.car.setXAxisControlValue(x);
      this.car.setYAxisControlValue(y);
    });
    this.keyboardController.bind(this.options.gearUpDownKeys[0]).pipe(takeUntil(this.stop$), filter(x => !!x)).subscribe(() => {
      if (this.car && (!this.car.carProperties.transmission.isAuto || this.car.gear <= 0)) {
        this.car.gear++;
      }
    });
    this.keyboardController.bind(this.options.gearUpDownKeys[1]).pipe(takeUntil(this.stop$), filter(x => !!x)).subscribe(() => {
      if (this.car.carProperties.transmission.isAuto && this.car.gear > 1) {
        this.car.gear = 0;
      } else {
        this.car.gear--;
      }
    });
  }

  async stop(): Promise<void> {
    this.stop$.next();
  }

}
