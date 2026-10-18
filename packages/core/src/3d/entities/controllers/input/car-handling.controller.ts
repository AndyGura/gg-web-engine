import { combineLatest, filter, Observable, Subject, take, takeUntil } from 'rxjs';
import {
  DirectionInput,
  DirectionKeymap,
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
   * custom codes per direction, or `null` for none. To rebind while the game runs, assign
   * `directionsInput.keymap`.
   */
  readonly keymap: DirectionKeymap | null;
  readonly maxSteerDeltaPerSecond: number;
  /**
   * The gamepad controls, bound on the world's `gamepadInput`. `DEFAULT_CAR_GAMEPAD_BINDING` when
   * omitted; `null` leaves the gamepad alone.
   */
  readonly gamepad?: CarGamepadBinding | null;
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
    runWhileInputEnabled(
      world,
      this._onRemoved$,
      () => this.directionsInput.start(),
      () => this.directionsInput.stop(),
    );
    const gamepad = this.options.gamepad === undefined ? DEFAULT_CAR_GAMEPAD_BINDING : this.options.gamepad;
    if (gamepad && world.gamepadInput) {
      const unbind = world.gamepadInput.bindDirection(this.directionsInput, {
        x: gamepad.steer,
        y: { negative: gamepad.brake, positive: gamepad.throttle },
      });
      this._onRemoved$.pipe(take(1)).subscribe(unbind);
    }
  }

  async onRemoved(): Promise<void> {
    await super.onRemoved();
    await this.directionsInput.stop();
  }
}
