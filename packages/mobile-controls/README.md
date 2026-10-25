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
| `CarHandlingController` (on its own) | steering, accelerate, brake; handbrake and gears for the keys in `car.keys` |
| `PlayerCharacterController` | move stick, look by dragging, jump, run, crouch, switch view |
| `PlayerCharacterController2d` | left/right, jump, run, crouch |
| `FreeCameraController` | move stick, look by dragging, up, down, boost |
| `ObjectGrabController` | grab, turning into release while something is held; throw, shown only then |

`OrbitCameraController` needs no controls, it follows one- and two-finger drags on the canvas itself.
Looking around by dragging the canvas itself (no look area) works on every controller too: core's
`MouseInput` reports a finger's movement times its `touchSensitivity` (3 by default), the same factor
the look area applies, so both feel alike.

By default the overlay exists only on a touch-first device (`enabled: 'auto'`); pass `enabled: true`
to try it with a mouse.

### Choosing a control scheme
Every built-in layout has variants:

```typescript
new MobileControls({
  // steering: 'buttons' (default) | 'stick' | 'tilt' - tilt steers by turning the device like a wheel
  // pedals: 'buttons' (default) | 'stick' - one analog stick, up for throttle, down for brake;
  // the buttons hold the controller's up and down directions like its keys, so both held follow its oppositeKeys
  car: { steering: 'tilt', pedals: 'stick', gears: false },
  // movement: 'stick' (default, appears under the thumb) | 'dpad'
  // look: 'drag' (default) | 'stick' (a second stick) | false
  character: { movement: 'dpad', look: 'drag', lookSensitivity: 4 },
  character2d: { movement: 'stick' },
  freeCamera: false, // no touch controls for this controller
  grab: { throw: false }, // grab/release only, no throw button
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

`inset` moves every control placed by numbers - the built-in layouts' and your own - away from the
overlay's edges, in the same units (negative: towards them). It is how a game pulls the driving
controls closer to the sides of a wide phone without restating every placement:

```typescript
new MobileControls({ inset: { left: -2, right: -2 } }); // or one number for all four edges
```

It sets `--gg-mc-inset-left`/`-right`/`-top`/`-bottom` on the overlay, so a stylesheet (a media query
for small screens, say) can set them as well.

### Pause and fullscreen buttons
```typescript
new MobileControls({
  pauseButton: true, // top left; pauses the world, and resumes it on the next press
  fullscreenButton: true, // top right; hidden where fullscreen is not available (an iPhone)
});
```

Both take `{ placement, icon, label }` too. The pause button's default (`world.pauseWorld()`, never
for a world whose `localPauseAllowed` is `false`, and `resumeWorld()` while paused) suits a game
without a pause menu. A game with one opens it instead - `pauseButton: { onPress: () =>
screens.push(new PauseScreen()) }`: a `ScreenManager` pauses the world under the menu and resumes it
when the menu closes, which it would not do for a world the button had paused. The fullscreen button
shows the overlay's `container` fullscreen (or the whole page), or `fullscreenButton: { element }`.
`toggleFullscreen(element?)`, `isFullscreenAvailable(element?)` and `fullscreen$()` are exported for a
button of your own: they cover the WebKit-prefixed API of older Safari and never throw.

Entering fullscreen needs a user gesture, and for a touch a browser grants one when the finger lifts,
not when it goes down - so call `toggleFullscreen` from `TouchButton.onTap` (the finger lifting on
the button), not from `onPress`. The same goes for anything else a browser allows only in reaction to
the user.

Other controls that belong to no controller stay on screen all the time:

```typescript
const controls = new MobileControls();
controls.addControls(
  new TouchButton({ id: 'map', content: 'M', placement: { left: 13, top: 4 } }).onPress(() => toggleMap()),
);
world.addEntity(controls);
```

### Showing the overlay only when it is wanted
`visible$` gates the overlay by an observable of your own, e.g. "the player is in a car and no menu
is open". While it last emitted `false` (and until it first emits) the overlay is off the screen,
and turning it off releases everything held, so no key stays pressed:

```typescript
new MobileControls({ visible$: combineLatest([inCar$, menuOpen$]).pipe(map(([car, menu]) => car && !menu)) });
```

A world whose input is switched off (`world.inputEnabled`, what a `ScreenManager` does to a covered
screen) takes the overlay off the screen without any of this.

### A car controller of your own
A game whose own entity drives the vehicle - its handbrake and gearbox included - while a bare
`CarHandlingController` child does the steering and the pedals gets the matching buttons through
`car.keys`: they press those keys on the `CarHandlingController`'s `keyboard`, where the app's
entity listens for them.

```typescript
new MobileControls({
  car: {
    // or a function of the controller, called each time the layout is built - which happens again
    // on the controller's own setKeys, or on controls.refresh() after the game's keys change
    keys: { handbrake: 'Space', gearUp: 'KeyE', gearDown: 'KeyQ' },
  },
});
```

A button whose key is left out is not shown; `handbrake: false`/`gears: false` turn them off as for
`GgCarHandlingController`, whose buttons always press its own `handbrakeKey`/`gearUpDownKeys`.

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

The default style is kept cheap for the GPU of a phone running a WebGL game below it, and a custom
style keeps it that way by following the same three rules:

- **Animate only `transform` and `opacity`, of an element that has `will-change` for them.** A
  button shrinks by `transform`, the stick knob moves by `transform`, and the floating stick moves
  and fades by `transform` and `opacity`. A transitioned `background`, `box-shadow` or size repaints
  on every frame of every press, and a transition on an element without `will-change` makes the
  browser create its layer at each press and drop it after.
- **Dim the controls with `--gg-mc-opacity`, never with `opacity` on the overlay** (on `.gg-mc` or
  on your `className`). An opacity below 1 over several layers is drawn through an offscreen pass on
  every frame, so `--gg-mc-opacity` is applied where it covers one layer: to each control, except
  the stick, where it dims the knob and the base's `::before` (which draws the base). An `opacity`
  of yours on the overlay also multiplies with `--gg-mc-opacity` rather than replacing it.
  Because the `::before` draws the base, a `background` or `border-color` set on
  `.gg-mc-stick-base` itself is painted under it: recolour the base through `--gg-mc-background` /
  `--gg-mc-border`, or style `.gg-mc-stick-base::before`.
- **Change colours without a transition.** A pressed button or d-pad arm swaps its background for
  `--gg-mc-active-background` at once: one small repaint per press and release.

Transitions are off under `prefers-reduced-motion: reduce`.

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
