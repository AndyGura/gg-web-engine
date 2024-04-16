import { filter, takeUntil } from 'rxjs';
import { GgWorld, IEntity, KeyboardInput, TickOrder } from '../../../../base';
import { GgCarEntity } from '../../gg-car/gg-car.entity';
import { CarKeyboardControllerOptions, CarKeyboardHandlingController } from './car-keyboard-handling.controller';

export type GgCarKeyboardControllerOptions = CarKeyboardControllerOptions & {
  gearUpDownKeys: [string, string];
  autoReverse: boolean;
  handbrakeKey: string;
};

export class GgCarKeyboardHandlingController extends IEntity {
  public readonly tickOrder = TickOrder.INPUT_CONTROLLERS;

  protected readonly carHandlingInput: CarKeyboardHandlingController;
  public switchingGearsEnabled: boolean = true;

  constructor(
    protected readonly keyboard: KeyboardInput,
    public car: GgCarEntity | null,
    protected readonly options: GgCarKeyboardControllerOptions = {
      keymap: 'arrows',
      maxSteerDeltaPerSecond: 12,
      gearUpDownKeys: ['KeyA', 'KeyZ'],
      autoReverse: true,
      handbrakeKey: 'Space',
    },
  ) {
    super();
    this.carHandlingInput = new CarKeyboardHandlingController(keyboard, options);
    this.addChildren(this.carHandlingInput);
  }

  async onSpawned(world: GgWorld<any, any>): Promise<void> {
    super.onSpawned(world);
    this.carHandlingInput.output$.pipe(takeUntil(this._onRemoved$)).subscribe(({ upDown, leftRight }) => {
      if (this.car) {
        this.car.steeringFactor = leftRight;
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
