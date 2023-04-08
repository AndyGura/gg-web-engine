import { BehaviorSubject, combineLatest, filter, interval, pipe, Subject, takeUntil } from 'rxjs';
import { distinctUntilChanged, map, pairwise, startWith, switchMap, take, tap } from 'rxjs/operators';
import { KeyboardInput } from '../../../../base/inputs/keyboard.input';
import { Gg3dRaycastVehicleEntity } from '../../gg-3d-raycast-vehicle.entity';
import {
  DirectionKeyboardInput,
  DirectionKeyboardKeymap,
  DirectionKeyboardOutput,
} from '../../../../base/inputs/direction.keyboard-input';
import { GgEntity } from '../../../../base/entities/gg-entity';
import { GGTickOrder, ITickListener } from '../../../../base/entities/interfaces/i-tick-listener';
import { GgWorld } from '../../../../base/gg-world';

// TODO pass as settings
// TODO smooth y?
const TICKER_INTERVAL = 16;
const TICKER_MAX_STEPS = 10;

export type CarKeyboardControllerOptions = {
  keymap: DirectionKeyboardKeymap;
  gearUpDownKeys: [string, string];
};

export class CarKeyboardHandlingController extends GgEntity implements ITickListener {
  public readonly tick$: Subject<[number, number]> = new Subject<[number, number]>();
  public readonly tickOrder = GGTickOrder.INPUT_CONTROLLERS;

  protected readonly directionsInput: DirectionKeyboardInput;
  // emits values -1 - 1; -1 = full turn left; 1 = full turn right
  protected readonly x$: BehaviorSubject<number> = new BehaviorSubject<number>(0);
  // emits values -1 - 1; -1 = full brake; 1 = full acceleration
  protected readonly y$: BehaviorSubject<number> = new BehaviorSubject<number>(0);

  protected lastX: number = 0;

  protected readonly car$: BehaviorSubject<Gg3dRaycastVehicleEntity> = new BehaviorSubject<Gg3dRaycastVehicleEntity>(
    null!,
  );

  public set car(value: Gg3dRaycastVehicleEntity) {
    this.car$.next(value);
  }

  public get car(): Gg3dRaycastVehicleEntity {
    return this.car$.getValue();
  }

  public switchingGearsEnabled: boolean = true;

  pairTickerPipe = pipe(
    startWith(0),
    pairwise<number>(),
    map(([beforeValue, afterValue]) => [this.lastX, afterValue] as [number, number]),
    switchMap(([beforeValue, afterValue]: [number, number]) =>
      interval(TICKER_INTERVAL).pipe(
        take(TICKER_MAX_STEPS),
        map(count => ++count),
        map(
          count =>
            beforeValue * ((TICKER_MAX_STEPS - count) / TICKER_MAX_STEPS) + afterValue * (count / TICKER_MAX_STEPS),
        ),
        tap(x => {
          this.lastX = x;
        }),
      ),
    ),
  );

  constructor(
    protected readonly keyboard: KeyboardInput,
    car: Gg3dRaycastVehicleEntity,
    protected readonly options: CarKeyboardControllerOptions = { keymap: 'arrows', gearUpDownKeys: ['KeyA', 'KeyZ'] },
  ) {
    super();
    this.car$.next(car);
    this.directionsInput = new DirectionKeyboardInput(keyboard, options.keymap);
  }

  async onSpawned(world: GgWorld<any, any>): Promise<void> {
    super.onSpawned(world);
    let moveDirection: DirectionKeyboardOutput = {};
    this.keyboard
      .bind(this.options.gearUpDownKeys[0])
      .pipe(
        takeUntil(this._onRemoved$),
        filter(x => this.switchingGearsEnabled && !!x),
      )
      .subscribe(() => {
        if (
          this.car$.getValue() &&
          (!this.car$.getValue().carProperties.transmission.isAuto || this.car$.getValue().gear <= 0)
        ) {
          this.car$.getValue().gear++;
        }
      });
    this.keyboard
      .bind(this.options.gearUpDownKeys[1])
      .pipe(
        takeUntil(this._onRemoved$),
        filter(x => this.switchingGearsEnabled && !!x),
      )
      .subscribe(() => {
        if (this.car$.getValue().carProperties.transmission.isAuto && this.car.gear > 1) {
          this.car$.getValue().gear = 0;
        } else {
          this.car$.getValue().gear--;
        }
      });
    this.directionsInput.output$.pipe(takeUntil(this._onRemoved$)).subscribe(d => {
      moveDirection = d;
    });
    this.car$
      .pipe(
        takeUntil(this._onRemoved$),
        switchMap(c => c.tick$),
        takeUntil(this._onRemoved$),
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
      this.x$.pipe(takeUntil(this._onRemoved$), distinctUntilChanged(), this.pairTickerPipe),
      this.y$.pipe(takeUntil(this._onRemoved$), distinctUntilChanged()),
    ]).subscribe(([x, y]) => {
      this.car$.getValue().setXAxisControlValue(x);
      this.car$.getValue().setYAxisControlValue(y);
    });
    await this.directionsInput.start();
  }

  async onRemoved(): Promise<void> {
    await this.directionsInput.stop();
  }
}
