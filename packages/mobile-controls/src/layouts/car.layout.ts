import { CarHandlingController, GgCarHandlingController } from '@gg-web-engine/core';
import { TouchButton } from '../controls/touch-button';
import { TouchStick } from '../controls/touch-stick';
import { MobileControlsIcons } from '../icons';
import { TiltInput, TiltInputOptions } from '../inputs/tilt.input';
import { LayoutBuilder, LayoutCustomization, MobileControlsLayoutFactory } from '../mobile-controls-layout';

export type CarLayoutControlId =
  | 'steer-left'
  | 'steer-right'
  | 'steer-stick'
  | 'accelerate'
  | 'brake'
  | 'pedal-stick'
  | 'handbrake'
  | 'gear-up'
  | 'gear-down';

/** The controllers `carLayout` builds controls for. */
export type CarLayoutController = GgCarHandlingController | CarHandlingController;

/**
 * The key codes the handbrake and gear buttons press for a bare `CarHandlingController`, whose own
 * options have no such keys (its steering/throttle input drives a vehicle whose handbrake and
 * gearbox the app's own entity handles). A button whose key is left out is not shown.
 */
export type CarLayoutKeys = {
  handbrake?: string;
  gearUp?: string;
  gearDown?: string;
};

export type CarLayoutOptions = LayoutCustomization<CarLayoutController, CarLayoutControlId> & {
  /**
   * How the car is steered: `'buttons'` (default) - a left and a right button, `'stick'` - an analog
   * stick moving sideways, `'tilt'` - by tilting the device like a steering wheel (see `TiltInput`).
   */
  steering?: 'buttons' | 'stick' | 'tilt';
  /** Options of the `TiltInput` behind `steering: 'tilt'`. */
  tilt?: Partial<TiltInputOptions>;
  /**
   * The pedals: `'buttons'` (default) - an accelerate and a brake button, `'stick'` - an analog stick
   * moving up (throttle) and down (brake), for a car whose controller takes a partial pedal. The
   * buttons hold the up and down directions of the controller's direction input the way its keys
   * do, so both held follow its `oppositeKeys`; the stick is an analog direction, summed. The
   * steering buttons likewise hold left and right.
   */
  pedals?: 'buttons' | 'stick';
  /**
   * Whether there is a handbrake button. `true` by default. A `GgCarHandlingController`'s presses
   * its `handbrakeKey`; a bare `CarHandlingController` has one only with `keys.handbrake`.
   */
  handbrake?: boolean;
  /**
   * Whether there are gear up/down buttons. For a `GgCarHandlingController` they press its
   * `gearUpDownKeys`, and `'auto'` (default) shows them when the driver has to shift: gear switching
   * is enabled on the controller, and the car has a manual gearbox or the controller does not pick
   * reverse by itself (`autoReverse`). A bare `CarHandlingController` has them only with
   * `keys.gearUp`/`keys.gearDown`, which `'auto'` shows.
   */
  gears?: boolean | 'auto';
  /**
   * The keys the handbrake and gear buttons press for a bare `CarHandlingController`, on the
   * controller's `keyboard` - for an app whose own entity drives the vehicle's handbrake and gearbox
   * by those keys, next to the steering and pedals of the `CarHandlingController` it wraps. A
   * function is called each time the layout is built, with the controller (its `parent` is the
   * app's entity), so it returns the keys bound at that moment: the layout is built again on the
   * controller's `'keys'` change and on `MobileControls.refresh`. Never used for a
   * `GgCarHandlingController`, whose buttons always press the keys it acts on.
   */
  keys?: CarLayoutKeys | ((controller: CarHandlingController) => CarLayoutKeys | null);
};

/**
 * The built-in layout for the car controllers: steering on the left, pedals on the right. For a
 * `GgCarHandlingController` also the handbrake and the gears; a bare
 * `CarHandlingController` (the steering/throttle half, usable with any vehicle) gets the
 * steering and the pedals, plus a handbrake and gear buttons for the keys given in `keys`.
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
    const pedals = options.pedals || 'buttons';
    // the row of small buttons sits higher over a stick, which is taller than a button
    const leftRow = steering === 'stick' ? 20 : 16;
    const rightRow = pedals === 'stick' ? 20 : 16;
    const bare = ggCar ? null : (controller as CarHandlingController);
    const keys = bare ? (typeof options.keys === 'function' ? options.keys(bare) : options.keys) || {} : {};
    const keyboard = ggCar ? ggCar.keyboard : bare!.keyboard;
    if (steering === 'buttons') {
      b.add('steer-left', () =>
        new TouchButton({
          id: 'steer-left',
          label: 'Steer left',
          content: b.icon('steer-left', MobileControlsIcons.left),
          placement: b.placement('steer-left', { left: 4, bottom: 4, width: 10, height: 10 }),
        }).bindDirection(direction, 'left'),
      );
      b.add('steer-right', () =>
        new TouchButton({
          id: 'steer-right',
          label: 'Steer right',
          content: b.icon('steer-right', MobileControlsIcons.right),
          placement: b.placement('steer-right', { left: 16, bottom: 4, width: 10, height: 10 }),
        }).bindDirection(direction, 'right'),
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
    if (pedals === 'stick') {
      b.add('pedal-stick', () =>
        new TouchStick({
          id: 'pedal-stick',
          label: 'Accelerate / brake',
          axes: 'y',
          placement: b.placement('pedal-stick', { right: 4, bottom: 3 }),
        }).bindDirection(direction),
      );
    } else {
      b.add('accelerate', () =>
        new TouchButton({
          id: 'accelerate',
          label: 'Accelerate',
          content: b.icon('accelerate', MobileControlsIcons.accelerate),
          placement: b.placement('accelerate', { right: 4, bottom: 4, width: 10, height: 10 }),
        }).bindDirection(direction, 'up'),
      );
      b.add('brake', () =>
        new TouchButton({
          id: 'brake',
          label: 'Brake',
          content: b.icon('brake', MobileControlsIcons.brake),
          placement: b.placement('brake', { right: 16, bottom: 4, width: 10, height: 10 }),
        }).bindDirection(direction, 'down'),
      );
    }
    const handbrakeKey = ggCar ? ggCar.options.handbrakeKey : keys.handbrake;
    if (handbrakeKey && (options.handbrake ?? true)) {
      b.add('handbrake', () =>
        new TouchButton({
          id: 'handbrake',
          label: 'Handbrake',
          content: b.icon('handbrake', MobileControlsIcons.handbrake),
          placement: b.placement('handbrake', { right: 5.5, bottom: rightRow, width: 7, height: 7 }),
        }).bindKey(keyboard, handbrakeKey),
      );
    }
    let gears = options.gears ?? 'auto';
    if (ggCar && gears === 'auto') {
      const isAutoGearbox = !!ggCar.car?.carProperties.transmission.isAuto;
      gears = ggCar.switchingGearsEnabled && !(isAutoGearbox && ggCar.options.autoReverse);
    }
    const [gearUpKey, gearDownKey] = ggCar ? ggCar.options.gearUpDownKeys : [keys.gearUp, keys.gearDown];
    if (gears && gearDownKey) {
      b.add('gear-down', () =>
        new TouchButton({
          id: 'gear-down',
          label: 'Gear down',
          content: b.icon('gear-down', MobileControlsIcons.minus),
          placement: b.placement('gear-down', { left: 5.5, bottom: leftRow, width: 7, height: 7 }),
        }).bindKey(keyboard, gearDownKey),
      );
    }
    if (gears && gearUpKey) {
      b.add('gear-up', () =>
        new TouchButton({
          id: 'gear-up',
          label: 'Gear up',
          content: b.icon('gear-up', MobileControlsIcons.plus),
          placement: b.placement('gear-up', { left: 17.5, bottom: leftRow, width: 7, height: 7 }),
        }).bindKey(keyboard, gearUpKey),
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
