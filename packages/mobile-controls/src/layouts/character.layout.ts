import { PlayerCharacterController } from '@gg-web-engine/core';
import { TouchButton } from '../controls/touch-button';
import { TouchDPad } from '../controls/touch-dpad';
import { TouchLookArea } from '../controls/touch-look-area';
import { TouchStick } from '../controls/touch-stick';
import { MobileControlsIcons } from '../icons';
import { LayoutBuilder, LayoutCustomization, MobileControlsLayoutFactory } from '../mobile-controls-layout';

export type CharacterLayoutControlId = 'look' | 'look-stick' | 'move' | 'jump' | 'run' | 'crouch' | 'view';

export type CharacterLayoutOptions = LayoutCustomization<PlayerCharacterController<any>, CharacterLayoutControlId> & {
  /**
   * How the character is moved: `'stick'` (default) - an analog stick that appears under the left
   * thumb wherever it lands, `'dpad'` - a directional pad in the corner.
   */
  movement?: 'stick' | 'dpad';
  /**
   * How the view is turned: `'drag'` (default) - by dragging anywhere the other controls are not,
   * `'stick'` - with a second stick on the right, `false` - not by this layout.
   */
  look?: 'drag' | 'stick' | false;
  /**
   * Multiplies the turning: of a drag, on top of the controller's `mouseSensitivity` (3 by default,
   * a finger covers much less distance than a mouse), or of the look stick's speed.
   */
  lookSensitivity?: number;
};

/**
 * The built-in layout for `PlayerCharacterController`: movement on the left, actions on the right,
 * looking around by dragging over the rest of the screen.
 */
export function characterLayout(
  options: CharacterLayoutOptions = {},
): MobileControlsLayoutFactory<PlayerCharacterController<any>> {
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
    // with a look stick in the corner the action buttons move into a row above it
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
    b.add('jump', () =>
      new TouchButton({
        id: 'jump',
        label: 'Jump',
        content: b.icon('jump', MobileControlsIcons.jump),
        placement: b.placement(
          'jump',
          stick ? { right: 4, bottom: 20, width: 8, height: 8 } : { right: 4, bottom: 5, width: 10, height: 10 },
        ),
      }).bindKey(controller.keyboard, controller.options.jumpKey),
    );
    b.add('run', () =>
      new TouchButton({
        id: 'run',
        label: 'Run',
        mode: 'toggle',
        content: b.icon('run', MobileControlsIcons.run),
        placement: b.placement(
          'run',
          stick ? { right: 14, bottom: 20, width: 8, height: 8 } : { right: 16, bottom: 4, width: 8, height: 8 },
        ),
      }).bindKey(controller.keyboard, controller.options.runKey),
    );
    b.add('crouch', () =>
      new TouchButton({
        id: 'crouch',
        label: 'Crouch',
        // a crouch that lasts while its key is held gets a latching button instead of a parked finger
        mode: controller.character?.options.crouchMode === 'toggle' ? 'hold' : 'toggle',
        content: b.icon('crouch', MobileControlsIcons.crouch),
        placement: b.placement(
          'crouch',
          stick ? { right: 24, bottom: 20, width: 8, height: 8 } : { right: 5, bottom: 17, width: 8, height: 8 },
        ),
      }).bindKey(controller.keyboard, controller.options.crouchKey),
    );
    const toggleViewKey = controller.options.toggleViewKey;
    if (toggleViewKey) {
      b.add('view', () =>
        new TouchButton({
          id: 'view',
          label: 'Switch view',
          content: b.icon('view', MobileControlsIcons.view),
          placement: b.placement('view', { right: 4, top: 4, width: 6.5, height: 6.5 }),
        }).bindKey(controller.keyboard, toggleViewKey),
      );
    }
    return b.finish(controller, context);
  };
}
