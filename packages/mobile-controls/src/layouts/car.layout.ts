import { CarHandlingController, GgCarHandlingController } from '@gg-web-engine/core';
import { TouchButton } from '../controls/touch-button';
import { TouchStick } from '../controls/touch-stick';
import { MobileControlsIcons } from '../icons';
import { TiltInput, TiltInputOptions } from '../inputs/tilt.input';
import { LayoutBuilder, LayoutCustomization, MobileControlsLayoutFactory } from '../mobile-controls-layout';

export type CarLayoutControlId =
  'steer-left' | 'steer-right' | 'steer-stick' | 'accelerate' | 'brake' | 'handbrake' | 'gear-up' | 'gear-down';

/** The controllers `carLayout` builds controls for. */
export type CarLayoutController = GgCarHandlingController | CarHandlingController;

export type CarLayoutOptions = LayoutCustomization<CarLayoutController, CarLayoutControlId> & {
  /**
   * How the car is steered: `'buttons'` (default) - a left and a right button, `'stick'` - an analog
   * stick moving sideways, `'tilt'` - by tilting the device like a steering wheel (see `TiltInput`).
   */
  steering?: 'buttons' | 'stick' | 'tilt';
  /** Options of the `TiltInput` behind `steering: 'tilt'`. */
  tilt?: Partial<TiltInputOptions>;
  /** Whether there is a handbrake button (`GgCarHandlingController` only). `true` by default. */
  handbrake?: boolean;
  /**
   * Whether there are gear up/down buttons (`GgCarHandlingController` only). `'auto'`
   * (default) shows them when the driver has to
   * shift: gear switching is enabled on the controller, and the car has a manual gearbox or the
   * controller does not pick reverse by itself (`autoReverse`).
   */
  gears?: boolean | 'auto';
};

/**
 * The built-in layout for the car controllers: steering on the left, pedals on the right. For a
 * `GgCarHandlingController` also the handbrake and the gears; a bare
 * `CarHandlingController` (the steering/throttle half, usable with any vehicle) gets the
 * steering and the pedals alone.
 */
export function carLayout(options: CarLayoutOptions = {}): MobileControlsLayoutFactory<CarLayoutController> {
  return (controller, context) => {
    if (controller.parent instanceof GgCarHandlingController) {
      // the half of a `GgCarHandlingController`, whose own layout already covers it
      return [];
    }
    const b = new LayoutBuilder(options);
    const ggCar = controller instanceof GgCarHandlingController ? controller : null;
    const direction = (ggCar ? ggCar.carHandlingInput : (controller as CarHandlingController)).directionsInput;
    const steering = options.steering || 'buttons';
    if (steering === 'buttons') {
      b.add('steer-left', () =>
        new TouchButton({
          id: 'steer-left',
          label: 'Steer left',
          content: b.icon('steer-left', MobileControlsIcons.left),
          placement: b.placement('steer-left', { left: 4, bottom: 4, width: 10, height: 10 }),
        }).bindDirection(direction, { x: -1 }),
      );
      b.add('steer-right', () =>
        new TouchButton({
          id: 'steer-right',
          label: 'Steer right',
          content: b.icon('steer-right', MobileControlsIcons.right),
          placement: b.placement('steer-right', { left: 16, bottom: 4, width: 10, height: 10 }),
        }).bindDirection(direction, { x: 1 }),
      );
    } else if (steering === 'stick') {
      b.add('steer-stick', () =>
        new TouchStick({
          id: 'steer-stick',
          label: 'Steering',
          axes: 'x',
          placement: b.placement('steer-stick', { left: 4, bottom: 3 }),
        }).bindDirection(direction),
      );
    }
    b.add('accelerate', () =>
      new TouchButton({
        id: 'accelerate',
        label: 'Accelerate',
        content: b.icon('accelerate', MobileControlsIcons.accelerate),
        placement: b.placement('accelerate', { right: 4, bottom: 4, width: 10, height: 10 }),
      }).bindDirection(direction, { y: 1 }),
    );
    b.add('brake', () =>
      new TouchButton({
        id: 'brake',
        label: 'Brake',
        content: b.icon('brake', MobileControlsIcons.brake),
        placement: b.placement('brake', { right: 16, bottom: 4, width: 10, height: 10 }),
      }).bindDirection(direction, { y: -1 }),
    );
    if (ggCar && (options.handbrake ?? true)) {
      b.add('handbrake', () =>
        new TouchButton({
          id: 'handbrake',
          label: 'Handbrake',
          content: b.icon('handbrake', MobileControlsIcons.handbrake),
          placement: b.placement('handbrake', { right: 5.5, bottom: 16, width: 7, height: 7 }),
        }).bindKey(ggCar.keyboard, ggCar.options.handbrakeKey),
      );
    }
    let gears = options.gears ?? 'auto';
    if (ggCar && gears === 'auto') {
      const isAutoGearbox = !!ggCar.car?.carProperties.transmission.isAuto;
      gears = ggCar.switchingGearsEnabled && !(isAutoGearbox && ggCar.options.autoReverse);
    }
    if (ggCar && gears) {
      b.add('gear-down', () =>
        new TouchButton({
          id: 'gear-down',
          label: 'Gear down',
          content: b.icon('gear-down', MobileControlsIcons.minus),
          placement: b.placement('gear-down', { left: 5.5, bottom: 16, width: 7, height: 7 }),
        }).bindKey(ggCar.keyboard, ggCar.options.gearUpDownKeys[1]),
      );
      b.add('gear-up', () =>
        new TouchButton({
          id: 'gear-up',
          label: 'Gear up',
          content: b.icon('gear-up', MobileControlsIcons.plus),
          placement: b.placement('gear-up', { left: 17.5, bottom: 16, width: 7, height: 7 }),
        }).bindKey(ggCar.keyboard, ggCar.options.gearUpDownKeys[0]),
      );
    }
    if (steering === 'tilt') {
      const tilt = new TiltInput(options.tilt);
      const subscription = tilt.value$.subscribe(x => direction.setAnalogDirection(tilt, x === 0 ? null : { x }));
      tilt.start();
      b.result.push({
        dispose: () => {
          subscription.unsubscribe();
          direction.setAnalogDirection(tilt, null);
          tilt.stop();
        },
      });
    }
    return b.finish(controller, context);
  };
}
