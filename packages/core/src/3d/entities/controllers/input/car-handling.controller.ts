import { combineLatest, filter, Observable, Subject, takeUntil } from 'rxjs';
import {
  DirectionInput,
  DirectionKeymap,
  BindingsChange,
  ControllerBindings,
  IRebindableController,
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

export class CarHandlingController extends IEntity implements IRebindableController {
  static readonly entityTypeName: string = 'CarHandlingController';
  public readonly tickOrder = TickOrder.INPUT_CONTROLLERS;

  public readonly directionsInput: DirectionInput;
  public readonly options: CarHandlingControllerOptions;

  private readonly bindings: ControllerBindings<CarHandlingControllerOptions, CarGamepadBinding>;

  /** Emits after every `setKeys` (`'keys'`) and `setGamepad` (`'gamepad'`) - see `IRebindableController` */
  public get bindingsChanged$(): Observable<BindingsChange> {
    return this.bindings.changed$;
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
    this.bindings.setKeys(keys);
  }

  /**
   * Rebinds the gamepad while the game runs - for a controls menu. The controls given replace the
   * current ones (over `DEFAULT_CAR_GAMEPAD_BINDING` while the gamepad is off), `null` turns the
   * gamepad off. Written to `options.gamepad`, taking effect at once. A control held while it is replaced
   * stops counting, and one already held when it is assigned (the button a menu just captured)
   * counts from its next push.
   *
   * @example
   * ```ts
   * controller.setGamepad({ throttle: 'b0', brake: 'b2' });
   * ```
   */
  public setGamepad(binding: Partial<CarGamepadBinding> | null): void {
    this.bindings.setGamepad(binding);
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
    // a copy: `setKeys` writes to it. `gamepad` left out is the default binding
    this.options = {
      ...options,
      gamepad: options.gamepad === undefined ? DEFAULT_CAR_GAMEPAD_BINDING : options.gamepad,
    };
    this.directionsInput = new DirectionInput(keyboard, options.keymap);
    this.bindings = new ControllerBindings(this.options, DEFAULT_CAR_GAMEPAD_BINDING, this._onRemoved$);
  }

  async onSpawned(world: GgWorld<any, any>): Promise<void> {
    super.onSpawned(world);
    this.bindings.followKeymap(this.directionsInput, o => o.keymap);
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
      this.bindings.followGamepadDirection(world.gamepadInput, this.directionsInput, g => ({
        x: g.steer,
        y: { negative: g.brake, positive: g.throttle },
      }));
    }
  }

  async onRemoved(): Promise<void> {
    await super.onRemoved();
    await this.directionsInput.stop();
  }
}
