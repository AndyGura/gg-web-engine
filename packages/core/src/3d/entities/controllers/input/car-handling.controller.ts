import { combineLatest, filter, map, Observable, startWith, Subject, take, takeUntil } from 'rxjs';
import { assignKeys } from '../../../../base/inputs/assign-keys';
import {
  DirectionInput,
  DirectionKeymap,
  followGamepadDirection,
  GamepadAxisBinding,
  GamepadControls,
  GgWorld,
  IEntity,
  KeyboardInput,
  runWhileInputEnabled,
  TickOrder,
} from '../../../../base';

/** Which gamepad controls steer and pedal - see `GamepadControl` for the control names */
export type CarGamepadBinding = {
  /** The steering axis, `negative` to the left */
  steer: GamepadAxisBinding;
  throttle: GamepadControls;
  brake: GamepadControls;
};

/** Left stick or d-pad steers, the right trigger is the throttle, the left one the brake */
export const DEFAULT_CAR_GAMEPAD_BINDING: CarGamepadBinding = {
  steer: { negative: ['a0-', 'b14'], positive: ['a0+', 'b15'] },
  throttle: 'b7',
  brake: 'b6',
};

export type CarHandlingControllerOptions = {
  /**
   * Steering (`left`/`right`) and pedal (`up` throttle, `down` brake) keys: `'arrows'` by default,
   * custom codes per direction, or `null` for none. `setKeys` changes it while the game runs.
   */
  readonly keymap: DirectionKeymap | null;
  readonly maxSteerDeltaPerSecond: number;
  /**
   * The gamepad controls, bound on the world's `gamepadInput`. `DEFAULT_CAR_GAMEPAD_BINDING` when
   * omitted; `null` leaves the gamepad alone. `setGamepad` changes it while the game runs.
   */
  readonly gamepad?: CarGamepadBinding | null;
};
/**
 * The keys of a `CarHandlingController`, which `setKeys` changes while the game runs
 */
export type CarHandlingControllerKeys = Pick<CarHandlingControllerOptions, 'keymap'>;

export type CarHandlingOutput = { upDown: number; leftRight: number };

export class CarHandlingController extends IEntity {
  static readonly entityTypeName: string = 'CarHandlingController';
  public readonly tickOrder = TickOrder.INPUT_CONTROLLERS;

  public readonly directionsInput: DirectionInput;
  public readonly options: CarHandlingControllerOptions;

  private readonly _bindingsChanged$: Subject<void> = new Subject<void>();

  /**
   * Emits after every `setKeys` and `setGamepad`, for whatever shows or uses this controller's
   * bindings (an on-screen hint, the touch layout of `@gg-web-engine/mobile-controls`, which
   * rebuilds itself on it)
   */
  public get bindingsChanged$(): Observable<void> {
    return this._bindingsChanged$.asObservable();
  }

  /**
   * Rebinds the steering and pedal keys while the game runs - for a controls menu. They are written
   * to `options` and take effect at once. A key held while it is replaced stops counting, and a new
   * key already held counts from its next press.
   *
   * @example
   * ```ts
   * controller.setKeys({ keymap: { up: 'KeyW', down: 'KeyS', left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'] } });
   * ```
   */
  public setKeys(keys: Partial<CarHandlingControllerKeys>): void {
    assignKeys(this.options, keys);
    if (keys.keymap !== undefined) {
      this.directionsInput.keymap = keys.keymap;
    }
    this._bindingsChanged$.next();
  }

  /**
   * Rebinds the gamepad while the game runs - for a controls menu. The controls given replace the
   * current ones (over `DEFAULT_CAR_GAMEPAD_BINDING` while the gamepad is off), `null` turns the
   * gamepad off. Written to `options.gamepad`, taking effect at once.
   *
   * @example
   * ```ts
   * controller.setGamepad({ throttle: 'b0', brake: 'b2' });
   * ```
   */
  public setGamepad(binding: Partial<CarGamepadBinding> | null): void {
    const options: { gamepad?: CarGamepadBinding | null } = this.options;
    options.gamepad =
      binding === null ? null : { ...(this.options.gamepad ?? DEFAULT_CAR_GAMEPAD_BINDING), ...binding };
    this._bindingsChanged$.next();
  }

  /** What `pick` reads from `options`, now and after every `setKeys`/`setGamepad` */
  private option$<T>(pick: (options: CarHandlingControllerOptions) => T): Observable<T> {
    return this._bindingsChanged$.pipe(
      startWith(undefined),
      map(() => pick(this.options)),
    );
  }

  private _output$: Subject<CarHandlingOutput> = new Subject<CarHandlingOutput>();
  public get output$(): Observable<CarHandlingOutput> {
    return this._output$.asObservable();
  }

  constructor(
    public readonly keyboard: KeyboardInput,
    options: CarHandlingControllerOptions = {
      keymap: 'arrows',
      maxSteerDeltaPerSecond: 12,
    },
  ) {
    super();
    // a copy: `setKeys` writes to it
    this.options = { ...options };
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
    runWhileInputEnabled(
      world,
      this._onRemoved$,
      () => this.directionsInput.start(),
      () => this.directionsInput.stop(),
    );
    if (world.gamepadInput) {
      const unbind = followGamepadDirection(
        world.gamepadInput,
        this.directionsInput,
        this.option$(o => {
          const gamepad = o.gamepad === undefined ? DEFAULT_CAR_GAMEPAD_BINDING : o.gamepad;
          return gamepad && { x: gamepad.steer, y: { negative: gamepad.brake, positive: gamepad.throttle } };
        }),
      );
      this._onRemoved$.pipe(take(1)).subscribe(unbind);
    }
  }

  async onRemoved(): Promise<void> {
    await super.onRemoved();
    await this.directionsInput.stop();
  }
}
