import { PlayerCharacterController2d } from '@gg-web-engine/core';
import { TouchButton } from '../controls/touch-button';
import { TouchStick } from '../controls/touch-stick';
import { MobileControlsIcons } from '../icons';
import { LayoutBuilder, LayoutCustomization, MobileControlsLayoutFactory } from '../mobile-controls-layout';

export type Character2dLayoutControlId = 'move-left' | 'move-right' | 'move' | 'jump' | 'run' | 'crouch';

export type Character2dLayoutOptions = LayoutCustomization<
  PlayerCharacterController2d<any>,
  Character2dLayoutControlId
> & {
  /**
   * How the character is moved: `'buttons'` (default) - a left and a right button, `'stick'` - an
   * analog stick moving sideways.
   */
  movement?: 'buttons' | 'stick';
};

/**
 * The built-in layout for `PlayerCharacterController2d`: left/right on the left, actions on the
 * right.
 */
export function character2dLayout(
  options: Character2dLayoutOptions = {},
): MobileControlsLayoutFactory<PlayerCharacterController2d<any>> {
  return (controller, context) => {
    const b = new LayoutBuilder(options);
    const direction = controller.directionsInput;
    if ((options.movement || 'buttons') === 'buttons') {
      b.add('move-left', () =>
        new TouchButton({
          id: 'move-left',
          label: 'Move left',
          content: b.icon('move-left', MobileControlsIcons.left),
          placement: b.placement('move-left', { left: 4, bottom: 4, width: 10, height: 10 }),
        }).bindDirection(direction, { x: -1 }),
      );
      b.add('move-right', () =>
        new TouchButton({
          id: 'move-right',
          label: 'Move right',
          content: b.icon('move-right', MobileControlsIcons.right),
          placement: b.placement('move-right', { left: 16, bottom: 4, width: 10, height: 10 }),
        }).bindDirection(direction, { x: 1 }),
      );
    } else {
      b.add('move', () =>
        new TouchStick({
          id: 'move',
          label: 'Move',
          axes: 'x',
          placement: b.placement('move', { left: 4, bottom: 3 }),
        }).bindDirection(direction),
      );
    }
    b.add('jump', () =>
      new TouchButton({
        id: 'jump',
        label: 'Jump',
        content: b.icon('jump', MobileControlsIcons.jump),
        placement: b.placement('jump', { right: 4, bottom: 4, width: 10, height: 10 }),
      }).bindKey(controller.keyboard, controller.options.jumpKey),
    );
    b.add('run', () =>
      new TouchButton({
        id: 'run',
        label: 'Run',
        mode: 'toggle',
        content: b.icon('run', MobileControlsIcons.run),
        placement: b.placement('run', { right: 16, bottom: 4, width: 8, height: 8 }),
      }).bindKey(controller.keyboard, controller.options.runKey),
    );
    b.add('crouch', () =>
      new TouchButton({
        id: 'crouch',
        label: 'Crouch',
        mode: controller.character?.options.crouchMode === 'toggle' ? 'hold' : 'toggle',
        content: b.icon('crouch', MobileControlsIcons.crouch),
        placement: b.placement('crouch', { right: 5, bottom: 16, width: 8, height: 8 }),
      }).bindKey(controller.keyboard, controller.options.crouchKey),
    );
    return b.finish(controller, context);
  };
}
