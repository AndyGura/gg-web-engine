import { filter, take, takeUntil } from 'rxjs';
import { GamepadControls, GgWorld, IEntity, KeyboardInput, TickOrder } from '../../../../base';
import { GgCarEntity } from '../../gg-car/gg-car.entity';
import {
  CarGamepadBinding,
  CarHandlingControllerOptions,
  CarHandlingController,
  DEFAULT_CAR_GAMEPAD_BINDING,
} from './car-handling.controller';

/** `CarGamepadBinding` plus the controls pressing the gear and handbrake keys */
export type GgCarGamepadBinding = CarGamepadBinding & {
  gearUp: GamepadControls;
  gearDown: GamepadControls;
  handbrake: GamepadControls;
};

/** `DEFAULT_CAR_GAMEPAD_BINDING`, the bumpers shift (RB up, LB down), A is the handbrake */
export const DEFAULT_GG_CAR_GAMEPAD_BINDING: GgCarGamepadBinding = {
  ...DEFAULT_CAR_GAMEPAD_BINDING,
  gearUp: 'b5',
  gearDown: 'b4',
  handbrake: 'b0',
};

export type GgCarHandlingControllerOptions = Omit<CarHandlingControllerOptions, 'gamepad'> & {
  gearUpDownKeys: [string, string];
  /**
   * Whether the throttle keys pick the driving direction by themselves. While `true`, holding
   * "down" brakes a car moving forward, and once it (nearly) stands still shifts into reverse and
   * swaps the two keys: "down" now accelerates backwards, "up" brakes - until the car stands still
   * again with "up" held, which shifts back into first gear. While `false`, "up" is always the
   * throttle and "down" always the brake, and the direction only changes with the gear keys.
   */
  autoReverse: boolean;
  /**
   * Whether `autoReverse` leaves a car in neutral alone. Default `true`: neutral is a gear the
   * driver picks and leaves with the gear keys, and the throttle keys only rev the engine in it.
   * With `false` neutral is never used: any throttle input shifts a car found in neutral (e.g. a
   * freshly spawned one) into first gear or reverse right away, so it drives with the throttle
   * keys alone. Pair it with `switchingGearsEnabled = false`, which turns the gear keys off. Has
   * no effect without `autoReverse`.
   */
  neutralGear?: boolean;
  handbrakeKey: string;
  /**
   * The gamepad controls, bound on the world's `gamepadInput`: steering and pedals go to the
   * direction input, the gear and handbrake controls press `gearUpDownKeys`/`handbrakeKey` on
   * `keyboard`. `DEFAULT_GG_CAR_GAMEPAD_BINDING` when omitted; `null` leaves the gamepad alone.
   */
  gamepad?: GgCarGamepadBinding | null;
};

/**
 * Keyboard driving for a `GgCarEntity`: throttle/brake and smoothed steering from the arrow keys
 * (or another `keymap`), gear up/down keys, a handbrake key and, with `autoReverse`, reversing by
 * holding "down" at a standstill. Set `car` to another car (or `null`) at any time, or `active =
 * false` to hand the car to something else.
 *
 * @example
 * ```ts
 * import { GgCarEntity, GgCarHandlingController } from '@gg-web-engine/core';
 *
 * const car = level.getChildEntityByName<GgCarEntity>('Car');
 * // without options: arrows, A/Z to shift up/down, Space for the handbrake, auto-reverse.
 * // Here: WASD, shifting with E/Q, and the throttle alone picks first gear or reverse.
 * const driving = new GgCarHandlingController(world.keyboardInput, car, {
 *   keymap: 'wasd',
 *   maxSteerDeltaPerSecond: 12,
 *   gearUpDownKeys: ['KeyE', 'KeyQ'],
 *   autoReverse: true,
 *   neutralGear: false,
 *   handbrakeKey: 'Space',
 * });
 * world.addEntity(driving);
 *
 * // the player gets out: the keys stop driving this car
 * driving.active = false;
 * ```
 */
export class GgCarHandlingController extends IEntity {
  static readonly entityTypeName: string = 'GgCarHandlingController';
  public readonly tickOrder = TickOrder.INPUT_CONTROLLERS;

  public readonly carHandlingInput: CarHandlingController;
  public switchingGearsEnabled: boolean = true;

  constructor(
    public readonly keyboard: KeyboardInput,
    public car: GgCarEntity | null,
    public readonly options: GgCarHandlingControllerOptions = {
      keymap: 'arrows',
      maxSteerDeltaPerSecond: 12,
      gearUpDownKeys: ['KeyA', 'KeyZ'],
      autoReverse: true,
      handbrakeKey: 'Space',
    },
  ) {
    super();
    this.carHandlingInput = new CarHandlingController(keyboard, {
      ...options,
      gamepad: options.gamepad === undefined ? DEFAULT_GG_CAR_GAMEPAD_BINDING : options.gamepad,
    });
    this.addChildren(this.carHandlingInput);
  }

  async onSpawned(world: GgWorld<any, any>): Promise<void> {
    super.onSpawned(world);
    const gamepad = this.options.gamepad === undefined ? DEFAULT_GG_CAR_GAMEPAD_BINDING : this.options.gamepad;
    if (gamepad && world.gamepadInput) {
      const unbind = world.gamepadInput.bindKeys(this.keyboard, {
        [this.options.gearUpDownKeys[0]]: gamepad.gearUp,
        [this.options.gearUpDownKeys[1]]: gamepad.gearDown,
        [this.options.handbrakeKey]: gamepad.handbrake,
      });
      this._onRemoved$.pipe(take(1)).subscribe(unbind);
    }
    this.carHandlingInput.output$.pipe(takeUntil(this._onRemoved$)).subscribe(({ upDown, leftRight }) => {
      if (this.car) {
        this.car.steeringFactor = leftRight;
        if (upDown !== 0 && this.options.autoReverse && this.options.neutralGear === false && this.car.gear === 0) {
          // the direction is settled right below, the same way as for a car already in first gear
          this.car.gear = 1;
        }
        if (upDown !== 0 && this.options.autoReverse && this.car.gear !== 0) {
          if (this.car.gear === -1) {
            if (upDown > 0 && this.car.raycastVehicle.getSpeed() > -1) {
              this.car.gear = 1;
            } else {
              upDown = -upDown;
            }
          } else {
            if (upDown < 0 && this.car.raycastVehicle.getSpeed() < 1) {
              this.car.gear = -1;
              upDown = -upDown;
            }
          }
        }
        if (upDown > 0) {
          this.car.acceleration = upDown;
          this.car.brake = 0;
        } else {
          this.car.acceleration = 0;
          this.car.brake = -upDown;
        }
      }
    });
    this.keyboard
      .bind(this.options.gearUpDownKeys[0])
      .pipe(
        takeUntil(this._onRemoved$),
        filter(x => this.active && this.switchingGearsEnabled && !!x),
      )
      .subscribe(() => {
        if (this.car && (!this.car.carProperties.transmission.isAuto || this.car.gear <= 0)) {
          this.car.gear++;
        }
      });
    this.keyboard
      .bind(this.options.gearUpDownKeys[1])
      .pipe(
        takeUntil(this._onRemoved$),
        filter(x => this.active && this.switchingGearsEnabled && !!x),
      )
      .subscribe(() => {
        if (this.car) {
          if (this.car.carProperties.transmission.isAuto && this.car.gear > 1) {
            this.car.gear = 0;
          } else {
            this.car.gear--;
          }
        }
      });
    this.keyboard
      .bind(this.options.handbrakeKey)
      .pipe(
        takeUntil(this._onRemoved$),
        filter(() => this.active),
      )
      .subscribe(isKeyDown => {
        if (this.car) {
          this.car.handBrake = isKeyDown;
        }
      });
  }
}
