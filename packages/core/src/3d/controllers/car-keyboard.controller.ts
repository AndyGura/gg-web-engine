import { BehaviorSubject, combineLatest, interval, pipe, Subject, takeUntil } from 'rxjs';
import { distinctUntilChanged, map, pairwise, startWith, switchMap, take, tap } from 'rxjs/operators';
import { IController } from '../../base/controllers/i-controller';
import { KeyboardController } from '../../base/controllers/keyboard.controller';
import { Gg3dRaycastVehicleEntity } from '../entities/gg-3d-raycast-vehicle.entity';

// TODO pass as settings
// TODO smooth y?
const TICKER_INTERVAL = 16;
const TICKER_MAX_STEPS = 10;

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
  ) {
  }

  async start(): Promise<void> {
    const keys = ['ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight'];
    let moveDirection: boolean[] = [];
    combineLatest(keys.map(c => this.keyboardController.bind(c)))
      .pipe(takeUntil(this.stop$))
      .subscribe((d: boolean[]) => {
        moveDirection = d;
      });
    this.car.tick$
      .pipe(
        takeUntil(this.stop$),
        map(() => {
          const [f, l, b, r] = moveDirection;
          const direction = [0, 0];
          if (l != r) direction[0] = l ? -1 : 1;
          if (f != b) direction[1] = f ? 1 : -1;
          return direction;
        }),
      )
      .subscribe(([x, y]) => {
        this.x$.next(x);
        this.y$.next(y);
      });
    combineLatest([
      this.x$.pipe(
        distinctUntilChanged(),
        this.pairTickerPipe,
      ),
      this.y$.pipe(
        distinctUntilChanged()
      ),
    ]).subscribe(([x, y]) => {
      this.car.setXAxisControlValue(x);
      this.car.setYAxisControlValue(y);
    })
  }

  async stop(): Promise<void> {
    this.stop$.next();
  }

}
