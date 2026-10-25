import { filter, Observable, takeUntil } from 'rxjs';
import {
  BindingsChange,
  IRebindableController,
  GamepadControls,
  GgWorld,
  IEntity,
  KeyboardInput,
  TickOrder,
} from '../../../../base';
import { ControllerBindings } from '../../../../base/inputs/rebindable-keys';
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
   * `setGamepad` changes it while the game runs.
   */
  gamepad?: GgCarGamepadBinding | null;
};

/**
 * The keys of a `GgCarHandlingController`, which `setKeys` changes while the game runs
 */
export type GgCarHandlingControllerKeys = Pick<
  GgCarHandlingControllerOptions,
  'keymap' | 'gearUpDownKeys' | 'handbrakeKey'
>;

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
export class GgCarHandlingController extends IEntity implements IRebindableController {
  static readonly entityTypeName: string = 'GgCarHandlingController';
  public readonly tickOrder = TickOrder.INPUT_CONTROLLERS;

  /**
   * The steering and pedals, driven by this controller: rebind them through this controller's
   * `setKeys`/`setGamepad`, which pass them on, never through the child's own
   */
  public readonly carHandlingInput: CarHandlingController;
  public switchingGearsEnabled: boolean = true;
  public readonly options: GgCarHandlingControllerOptions;

  private readonly bindings: ControllerBindings<GgCarHandlingControllerOptions, GgCarGamepadBinding>;

  /** Emits after every `setKeys` (`'keys'`) and `setGamepad` (`'gamepad'`) - see `IRebindableController` */
  public get bindingsChanged$(): Observable<BindingsChange> {
    return this.bindings.changed$;
  }

  /**
   * Rebinds keys while the game runs - for a controls menu. Only the keys given change; they are
   * written to `options` and take effect at once, keyboard and gamepad alike (the gamepad presses
   * whichever key its button is for). A key held while it is replaced stops counting, and a new
   * key already held counts from its next press.
   *
   * @example
   * ```ts
   * driving.setKeys({ gearUpDownKeys: ['KeyE', 'KeyQ'], handbrakeKey: 'KeyB' });
   * ```
   */
  public setKeys(keys: Partial<GgCarHandlingControllerKeys>): void {
    // the child first, so a listener to `bindingsChanged$` finds the steering keys rebound too
    if (keys.keymap !== undefined) {
      this.carHandlingInput.setKeys({ keymap: keys.keymap });
    }
    this.bindings.setKeys(keys);
  }

  /**
   * Rebinds the gamepad while the game runs - for a controls menu. The controls given replace the
   * current ones (over `DEFAULT_GG_CAR_GAMEPAD_BINDING` while the gamepad is off), `null` turns the
   * gamepad off. Written to `options.gamepad`, taking effect at once. A control held while it is
   * replaced stops counting, and one already held when it is assigned (the button a menu just
   * captured) counts from its next push.
   *
   * @example
   * ```ts
   * driving.setGamepad({ gearUp: 'b3', gearDown: 'b2' });
   * ```
   */
  public setGamepad(binding: Partial<GgCarGamepadBinding> | null): void {
    this.carHandlingInput.setGamepad(GgCarHandlingController.carControls(this.bindings.setGamepad(binding)));
  }

  /** The steering and pedal controls of `binding`: what `carHandlingInput` is given, never the gear ones */
  private static carControls(binding: GgCarGamepadBinding | null): CarGamepadBinding | null {
    return binding && { steer: binding.steer, throttle: binding.throttle, brake: binding.brake };
  }

  constructor(
    public readonly keyboard: KeyboardInput,
    public car: GgCarEntity | null,
    options: GgCarHandlingControllerOptions = {
      keymap: 'arrows',
      maxSteerDeltaPerSecond: 12,
      gearUpDownKeys: ['KeyA', 'KeyZ'],
      autoReverse: true,
      handbrakeKey: 'Space',
    },
  ) {
    super();
    // a copy: `setKeys` writes to it. `gamepad` left out is the default binding
    this.options = {
      ...options,
      gamepad: options.gamepad === undefined ? DEFAULT_GG_CAR_GAMEPAD_BINDING : options.gamepad,
    };
    this.carHandlingInput = new CarHandlingController(keyboard, {
      keymap: this.options.keymap,
      maxSteerDeltaPerSecond: this.options.maxSteerDeltaPerSecond,
      oppositeKeys: this.options.oppositeKeys,
      gamepad: GgCarHandlingController.carControls(this.options.gamepad ?? null),
    });
    this.addChildren(this.carHandlingInput);
    this.bindings = new ControllerBindings(this.options, DEFAULT_GG_CAR_GAMEPAD_BINDING, this._onRemoved$);
  }

  async onSpawned(world: GgWorld<any, any>): Promise<void> {
    super.onSpawned(world);
    const gamepadInput = world.gamepadInput;
    if (gamepadInput) {
      this.bindings.followGamepadKey(
        gamepadInput,
        this.keyboard,
        o => o.gearUpDownKeys[0],
        g => g.gearUp,
      );
      this.bindings.followGamepadKey(
        gamepadInput,
        this.keyboard,
        o => o.gearUpDownKeys[1],
        g => g.gearDown,
      );
      this.bindings.followGamepadKey(
        gamepadInput,
        this.keyboard,
        o => o.handbrakeKey,
        g => g.handbrake,
      );
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
    this.bindings
      .followKey(this.keyboard, o => o.gearUpDownKeys[0])
      .pipe(
        takeUntil(this._onRemoved$),
        filter(x => this.active && this.switchingGearsEnabled && !!x),
      )
      .subscribe(() => {
        if (this.car && (!this.car.carProperties.transmission.isAuto || this.car.gear <= 0)) {
          this.car.gear++;
        }
      });
    this.bindings
      .followKey(this.keyboard, o => o.gearUpDownKeys[1])
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
    this.bindings
      .followKey(this.keyboard, o => o.handbrakeKey)
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
