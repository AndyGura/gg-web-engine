<p align="center">
  <img src="../../documentation/assets/banner.png" width="100%" alt="GG Web Engine"/>
</p>

## On-screen touch controls for [gg-web-engine](https://github.com/AndyGura/gg-web-engine)

`@gg-web-engine/mobile-controls` puts buttons, sticks and d-pads over the game canvas on phones and
tablets. It is plain DOM with no dependency besides the core, and a separate package on purpose: an
app that does not import it ships none of it.

### Installation:
1) make sure **@gg-web-engine/core** installed
1) `npm install --save @gg-web-engine/mobile-controls`

### Usage
```typescript
import { MobileControls } from '@gg-web-engine/mobile-controls';

world.addEntity(new MobileControls());
```

That is the whole setup. The overlay watches the world and shows the controls of whichever input
controller is active, swapping them as controllers are activated, deactivated, spawned and removed
(walking up to a car and driving off swaps the character controls for the car controls):

| Controller | Controls |
|---|---|
| `GgCarHandlingController` | steering, accelerate, brake, handbrake, gears when the driver has to shift |
| `CarHandlingController` (on its own) | steering, accelerate, brake |
| `PlayerCharacterController` | move stick, look by dragging, jump, run, crouch, switch view |
| `PlayerCharacterController2d` | left/right, jump, run, crouch |
| `FreeCameraController` | move stick, look by dragging, up, down, boost |

`OrbitCameraController` needs no controls, it follows one- and two-finger drags on the canvas itself.

By default the overlay exists only on a touch-first device (`enabled: 'auto'`); pass `enabled: true`
to try it with a mouse.

### Choosing a control scheme
Every built-in layout has variants:

```typescript
new MobileControls({
  // 'buttons' (default) | 'stick' | 'tilt' - tilt steers by turning the device like a wheel
  car: { steering: 'tilt', gears: false },
  // movement: 'stick' (default, appears under the thumb) | 'dpad'
  // look: 'drag' (default) | 'stick' (a second stick) | false
  character: { movement: 'dpad', look: 'drag', lookSensitivity: 4 },
  character2d: { movement: 'stick' },
  freeCamera: false, // no touch controls for this controller
});
```

### Adjusting a layout
Each control of a layout has an id (`'accelerate'`, `'jump'`, `'move'`, ... - see the
`*LayoutControlId` types). The layout options take them to move, restyle, hide or add controls:

```typescript
new MobileControls({
  car: {
    placements: { handbrake: { right: 28, bottom: 4 } }, // numbers are multiples of --gg-mc-unit
    icons: { accelerate: '<img src="assets/pedal.svg">', brake: 'B' },
    hide: ['gear-up', 'gear-down'],
    extra: (controller, { world }) => [
      new TouchButton({ id: 'horn', content: '📣', placement: { right: 4, top: 4 } })
        .bindKey(world.keyboardInput, 'KeyH'),
    ],
  },
});
```

Controls that belong to no controller stay on screen all the time:

```typescript
const controls = new MobileControls();
controls.addControls(
  new TouchButton({ id: 'pause', content: 'II', placement: { left: 4, top: 4 } }).onPress(() => togglePause()),
);
world.addEntity(controls);
```

A single control is hidden and shown with `control.visible` (an action not available right now) and
moved with `control.place({...})`. `controls.visible = false` hides everything (a menu, a cutscene) and releases whatever was held.

### Styling
The default stylesheet is driven by CSS custom properties on the overlay, so a class of your own
restyles everything, and `.gg-mc-id-<id>` reaches a single control:

```css
.my-controls {
  --gg-mc-unit: 9px;                 /* everything is sized in this */
  --gg-mc-color: #ffd166;
  --gg-mc-background: rgba(0, 0, 0, 0.4);
  --gg-mc-border: rgba(255, 209, 102, 0.7);
  --gg-mc-active-background: rgba(255, 209, 102, 0.5);
  --gg-mc-opacity: 1;
}
.my-controls .gg-mc-id-jump { border-radius: 20%; }
```
```typescript
new MobileControls({ className: 'my-controls' });
```

`injectStyles: false` drops the default stylesheet altogether for a fully custom look.

### Your own layout, your own controller
A layout is a function from a controller to controls. Register one for any entity class - your own
controller, or a built-in one to replace its layout wholesale:

```typescript
controls.registerLayout(TurretController, (turret, { world }) => [
  new TouchLookArea().bindMouse(turret.mouseInput, 3),
  new TouchStick({ id: 'aim', placement: { left: 4, bottom: 3 } }).bindDirection(turret.directionsInput),
  new TouchButton({ id: 'fire', content: 'FIRE', placement: { right: 4, bottom: 4, width: 12, height: 12 } })
    .onPress(() => turret.fire()),
]);
```

The controls bind to what the engine already has, so nothing in the controller needs to know about
touch:

| Binding | Effect |
|---|---|
| `button.bindKey(keyboard, 'Space')` | the button is that key (`KeyboardInput.emulateKeyDown/Up`) |
| `button.bindDirection(input, { x: -1 })` | pushes a `DirectionInput` while pressed |
| `stick.bindDirection(input)` | analog direction into a `DirectionInput` |
| `stick.bindKeys(keyboard, { up: 'KeyW', ... })` | holds keys past a threshold |
| `stick.bindLook(mouse)` / `lookArea.bindMouse(mouse)` | turns the view like the mouse does (`MouseInput.emulateMove`) |
| `button.pressed$`, `stick.value$`, `lookArea.delta$`/`tap$` | plain observables for anything else |

`TouchButton`, `TouchStick`, `TouchDPad` and `TouchLookArea` do not need the overlay: each owns a DOM
`element` you can append anywhere in your own UI. `TiltInput` is likewise usable alone.

### Where the overlay goes
By default it is added to `document.body` and covers the viewport, which suits a game filling the
page. For a canvas that takes a part of the page, or one shown through the Fullscreen API, wrap the
canvas in a positioned element and pass it as `container`: the overlay then covers exactly that
element and goes fullscreen with it.

```typescript
new MobileControls({ container: document.getElementById('game-wrapper') });
```

### Notes
- A look area covers the canvas, so taps on the canvas itself do not reach the page while a layout
  with `look: 'drag'` is shown; use the area's `tap$`, or `look: false`.
- Tilt steering works on pages served over https (or from localhost) only - a phone opening a dev
  server by its LAN address over plain http gets no orientation data.
- Tilt steering needs the device orientation permission on iOS. `TiltInput` asks for it on the first
  tap after it starts and reports the outcome through `permission$`.
- A layout is built once per activation of its controller. After changing something it was built
  from (e.g. giving the car controller a car with another gearbox), call `controls.refresh()`.
