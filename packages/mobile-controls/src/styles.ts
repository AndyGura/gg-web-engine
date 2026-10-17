/**
 * The id of the `<style>` element `injectMobileControlsStyles` adds to the document head.
 */
export const MOBILE_CONTROLS_STYLE_ID = 'gg-mobile-controls-styles';

/**
 * The default stylesheet of the overlay. `--gg-mc-unit` follows the viewport so that the built-in
 * layouts, which are up to 55 units wide, fit a phone held upright as well as on its side (at least
 * 58 units across). Everything is sized in `--gg-mc-unit` and colored through
 * the other `--gg-mc-*` custom properties declared on `.gg-mc`, so an app restyles the overlay by
 * overriding those on its own class, and a single control through its `.gg-mc-id-*` class.
 *
 * The overlay sits over a WebGL game, often on a weak mobile GPU, so it is kept cheap for it:
 * - Whatever moves or fades is a compositor layer for good (`will-change`): buttons (scaled by a
 *   transform), the stick knob, and the floating stick's base with its `::before`. A press never
 *   promotes or demotes a layer, and nothing animates a property that repaints.
 * - Nothing translucent contains such a layer. An opacity below 1 over several layers is drawn
 *   through an offscreen pass on every frame, so `--gg-mc-opacity` is applied where it covers a
 *   single layer: to each control, except the stick, where it is on the knob and on the `::before`
 *   that draws the base (the knob is inside the base). An app dims the controls through
 *   `--gg-mc-opacity`, never through `opacity` on the overlay.
 * - The pressed colour of a button or d-pad arm replaces its background with no transition: one
 *   small repaint per press and release.
 * Transitions are off under `prefers-reduced-motion: reduce`.
 */
export const MOBILE_CONTROLS_CSS = `
.gg-mc {
  --gg-mc-unit: clamp(5px, min(2vmin, 1.7vw), 10px);
  --gg-mc-color: #fff;
  --gg-mc-background: rgba(18, 22, 30, 0.3);
  --gg-mc-border: rgba(255, 255, 255, 0.6);
  --gg-mc-active-background: rgba(255, 255, 255, 0.4);
  --gg-mc-opacity: 0.85;
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 1000;
  overflow: hidden;
  pointer-events: none;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
  -webkit-tap-highlight-color: transparent;
  color: var(--gg-mc-color);
  font: 600 calc(var(--gg-mc-unit) * 2.4) / 1 system-ui, -apple-system, 'Segoe UI', sans-serif;
}
.gg-mc.gg-mc--contained {
  position: absolute;
}
.gg-mc-control {
  position: absolute;
  box-sizing: border-box;
  pointer-events: auto;
  touch-action: none;
  opacity: var(--gg-mc-opacity, 1);
}
.gg-mc-control[hidden] {
  display: none;
}
.gg-mc-control svg {
  width: 52%;
  height: 52%;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
  pointer-events: none;
}
.gg-mc-button {
  width: calc(var(--gg-mc-unit) * 8);
  height: calc(var(--gg-mc-unit) * 8);
  display: flex;
  align-items: center;
  justify-content: center;
  border: calc(var(--gg-mc-unit) * 0.22) solid var(--gg-mc-border);
  border-radius: 50%;
  background: var(--gg-mc-background);
  will-change: transform;
  transition: transform 60ms ease-out;
}
.gg-mc-button.gg-mc-active {
  background: var(--gg-mc-active-background);
  transform: scale(0.93);
}
.gg-mc-stick {
  width: calc(var(--gg-mc-unit) * 15);
  height: calc(var(--gg-mc-unit) * 15);
  opacity: 1;
}
.gg-mc-stick-base {
  position: absolute;
  left: 50%;
  top: 50%;
  width: calc(var(--gg-mc-unit) * 15);
  height: calc(var(--gg-mc-unit) * 15);
  box-sizing: border-box;
  border: calc(var(--gg-mc-unit) * 0.22) solid transparent;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  pointer-events: none;
}
.gg-mc-stick-base::before {
  content: '';
  position: absolute;
  top: calc(var(--gg-mc-unit) * -0.22);
  right: calc(var(--gg-mc-unit) * -0.22);
  bottom: calc(var(--gg-mc-unit) * -0.22);
  left: calc(var(--gg-mc-unit) * -0.22);
  box-sizing: border-box;
  border: calc(var(--gg-mc-unit) * 0.22) solid var(--gg-mc-border);
  border-radius: 50%;
  background: var(--gg-mc-background);
  opacity: var(--gg-mc-opacity, 1);
}
.gg-mc-stick-knob {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 44%;
  height: 44%;
  box-sizing: border-box;
  border: calc(var(--gg-mc-unit) * 0.22) solid var(--gg-mc-border);
  border-radius: 50%;
  background: var(--gg-mc-active-background);
  transform: translate(-50%, -50%);
  opacity: var(--gg-mc-opacity, 1);
  will-change: transform, opacity;
}
.gg-mc-stick--floating .gg-mc-stick-base {
  left: calc(var(--gg-mc-unit) * 13 + env(safe-area-inset-left, 0px));
  top: calc(100% - var(--gg-mc-unit) * 12 - env(safe-area-inset-bottom, 0px));
  will-change: transform;
}
.gg-mc-stick--floating .gg-mc-stick-base::before {
  will-change: opacity;
}
.gg-mc-stick--floating .gg-mc-stick-base::before,
.gg-mc-stick--floating .gg-mc-stick-knob {
  transition: opacity 120ms ease-out;
}
.gg-mc-stick--floating:not(.gg-mc-active) .gg-mc-stick-base::before,
.gg-mc-stick--floating:not(.gg-mc-active) .gg-mc-stick-knob {
  opacity: calc(var(--gg-mc-opacity, 1) * 0.55);
}
.gg-mc-dpad {
  width: calc(var(--gg-mc-unit) * 19);
  height: calc(var(--gg-mc-unit) * 19);
}
.gg-mc-dpad-arm {
  position: absolute;
  width: 34%;
  height: 34%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  border: calc(var(--gg-mc-unit) * 0.22) solid var(--gg-mc-border);
  border-radius: 22%;
  background: var(--gg-mc-background);
  pointer-events: none;
}
.gg-mc-dpad-arm.gg-mc-active {
  background: var(--gg-mc-active-background);
}
.gg-mc-dpad-arm--up {
  left: 33%;
  top: 0;
}
.gg-mc-dpad-arm--down {
  left: 33%;
  bottom: 0;
}
.gg-mc-dpad-arm--left {
  left: 0;
  top: 33%;
}
.gg-mc-dpad-arm--right {
  right: 0;
  top: 33%;
}
@media (prefers-reduced-motion: reduce) {
  .gg-mc-button,
  .gg-mc-stick--floating .gg-mc-stick-base::before,
  .gg-mc-stick--floating .gg-mc-stick-knob {
    transition: none;
  }
}
`;

/**
 * Adds the default stylesheet to the document head, once per document.
 */
export function injectMobileControlsStyles(): void {
  if (typeof document === 'undefined' || document.getElementById(MOBILE_CONTROLS_STYLE_ID)) {
    return;
  }
  const style = document.createElement('style');
  style.id = MOBILE_CONTROLS_STYLE_ID;
  style.textContent = MOBILE_CONTROLS_CSS;
  document.head.appendChild(style);
}
