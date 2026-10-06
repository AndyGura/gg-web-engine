import { ObjectGrabController } from '@gg-web-engine/core';
import { TouchButton } from '../controls/touch-button';
import { MobileControlsIcons } from '../icons';
import { LayoutBuilder, LayoutCustomization, MobileControlsLayoutFactory } from '../mobile-controls-layout';

/** `'release'` is not a control of its own: it names the icon the grab button shows while something is held. */
export type GrabLayoutControlId = 'grab' | 'release' | 'throw';

export type GrabLayoutOptions = LayoutCustomization<ObjectGrabController<any>, GrabLayoutControlId> & {
  /** Whether a throw button appears while something is held. `true` by default. */
  throw?: boolean;
};

/**
 * The built-in layout for `ObjectGrabController`: a grab button that turns into a release button
 * while something is carried, and a throw button shown only then. Meant to sit next to the layout of
 * the controller it is paired with (`PlayerCharacterController`'s, as a rule), above its action
 * buttons.
 */
export function grabLayout(options: GrabLayoutOptions = {}): MobileControlsLayoutFactory<ObjectGrabController<any>> {
  return (controller, context) => {
    const b = new LayoutBuilder(options);
    let grab: TouchButton | null = null;
    let throwButton: TouchButton | null = null;
    b.add(
      'grab',
      () =>
        (grab = new TouchButton({
          id: 'grab',
          label: 'Grab',
          content: b.icon('grab', MobileControlsIcons.grab),
          placement: b.placement('grab', { right: 15, bottom: 15, width: 8, height: 8 }),
        }).bindKey(controller.keyboard, controller.options.grabKey)),
    );
    if (options.throw ?? true) {
      b.add(
        'throw',
        () =>
          (throwButton = new TouchButton({
            id: 'throw',
            label: 'Throw',
            content: b.icon('throw', MobileControlsIcons.throw),
            placement: b.placement('throw', { right: 25, bottom: 15, width: 8, height: 8 }),
          }).onPress(() => controller.throwHeld())),
      );
    }
    // the grab button reads as "release" while something is held, and the throw button only exists then
    const subscription = controller.heldObject$.subscribe(held => {
      if (grab) {
        grab.setContent(
          held ? b.icon('release', MobileControlsIcons.release) : b.icon('grab', MobileControlsIcons.grab),
        );
        grab.element.setAttribute('aria-label', held ? 'Release' : 'Grab');
        grab.element.classList.toggle('gg-mc-holding', !!held);
      }
      if (throwButton) {
        throwButton.visible = !!held;
      }
    });
    return [...b.finish(controller, context), { dispose: () => subscription.unsubscribe() }];
  };
}
