import { FreeCameraController } from '@gg-web-engine/core';
import { TouchButton } from '../controls/touch-button';
import { TouchDPad } from '../controls/touch-dpad';
import { TouchLookArea } from '../controls/touch-look-area';
import { TouchStick } from '../controls/touch-stick';
import { MobileControlsIcons } from '../icons';
import { LayoutBuilder, LayoutCustomization, MobileControlsLayoutFactory } from '../mobile-controls-layout';

export type FreeCameraLayoutControlId = 'look' | 'look-stick' | 'move' | 'ascend' | 'descend' | 'boost';

export type FreeCameraLayoutOptions = LayoutCustomization<FreeCameraController, FreeCameraLayoutControlId> & {
  /** How the camera is moved - see `CharacterLayoutOptions.movement`. `'stick'` by default. */
  movement?: 'stick' | 'dpad';
  /** How the camera is turned - see `CharacterLayoutOptions.look`. `'drag'` by default. */
  look?: 'drag' | 'stick' | false;
  /** Multiplies the turning - see `CharacterLayoutOptions.lookSensitivity`. */
  lookSensitivity?: number;
};

/**
 * The built-in layout for `FreeCameraController`: flying on the left, up/down/boost on the right,
 * looking around by dragging over the rest of the screen.
 */
export function freeCameraLayout(
  options: FreeCameraLayoutOptions = {},
): MobileControlsLayoutFactory<FreeCameraController> {
  return (controller, context) => {
    const b = new LayoutBuilder(options);
    const look = options.look ?? 'drag';
    if (look === 'drag') {
      b.add('look', () =>
        new TouchLookArea({
          id: 'look',
          placement: b.placement('look', { left: '0', top: '0', width: '100%', height: '100%' }),
        }).bindMouse(controller.mouseInput, options.lookSensitivity ?? 3),
      );
    }
    if ((options.movement || 'stick') === 'stick') {
      b.add('move', () =>
        new TouchStick({
          id: 'move',
          label: 'Move',
          mode: 'floating',
          placement: b.placement('move', { left: '0', bottom: '0', width: '45%', height: '75%' }),
        }).bindDirection(controller.directionsInput),
      );
    } else {
      b.add('move', () =>
        new TouchDPad({
          id: 'move',
          label: 'Move',
          placement: b.placement('move', { left: 4, bottom: 4 }),
        }).bindDirection(controller.directionsInput),
      );
    }
    const stick = look === 'stick';
    if (stick) {
      b.add('look-stick', () =>
        new TouchStick({
          id: 'look-stick',
          label: 'Look',
          placement: b.placement('look-stick', { right: 4, bottom: 3 }),
        }).bindLook(controller.mouseInput, 900 * (options.lookSensitivity ?? 1)),
      );
    }
    // the keys `FreeCameraController` moves up/down and boosts with are fixed
    b.add('ascend', () =>
      new TouchButton({
        id: 'ascend',
        label: 'Up',
        content: b.icon('ascend', MobileControlsIcons.up),
        placement: b.placement(
          'ascend',
          stick ? { right: 4, bottom: 20, width: 8, height: 8 } : { right: 4, bottom: 15, width: 9, height: 9 },
        ),
      }).bindKey(controller.keyboard, 'KeyE'),
    );
    b.add('descend', () =>
      new TouchButton({
        id: 'descend',
        label: 'Down',
        content: b.icon('descend', MobileControlsIcons.down),
        placement: b.placement(
          'descend',
          stick ? { right: 14, bottom: 20, width: 8, height: 8 } : { right: 4, bottom: 4, width: 9, height: 9 },
        ),
      }).bindKey(controller.keyboard, 'KeyQ'),
    );
    b.add('boost', () =>
      new TouchButton({
        id: 'boost',
        label: 'Boost',
        mode: 'toggle',
        content: b.icon('boost', MobileControlsIcons.run),
        placement: b.placement(
          'boost',
          stick ? { right: 24, bottom: 20, width: 8, height: 8 } : { right: 15, bottom: 4, width: 8, height: 8 },
        ),
      }).bindKey(controller.keyboard, 'ShiftLeft'),
    );
    return b.finish(controller, context);
  };
}
