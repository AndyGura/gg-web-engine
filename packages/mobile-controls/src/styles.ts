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
  inset: 0;
  z-index: 1000;
  overflow: hidden;
  pointer-events: none;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
  -webkit-tap-highlight-color: transparent;
  color: var(--gg-mc-color);
  opacity: var(--gg-mc-opacity);
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
  transition: transform 60ms ease-out, background-color 60ms ease-out;
}
.gg-mc-button.gg-mc-active {
  background: var(--gg-mc-active-background);
  transform: scale(0.93);
}
.gg-mc-stick {
  width: calc(var(--gg-mc-unit) * 15);
  height: calc(var(--gg-mc-unit) * 15);
}
.gg-mc-stick-base {
  position: absolute;
  left: 50%;
  top: 50%;
  width: calc(var(--gg-mc-unit) * 15);
  height: calc(var(--gg-mc-unit) * 15);
  box-sizing: border-box;
  border: calc(var(--gg-mc-unit) * 0.22) solid var(--gg-mc-border);
  border-radius: 50%;
  background: var(--gg-mc-background);
  transform: translate(-50%, -50%);
  pointer-events: none;
}
.gg-mc-stick--floating .gg-mc-stick-base {
  left: calc(var(--gg-mc-unit) * 13 + env(safe-area-inset-left, 0px));
  top: calc(100% - var(--gg-mc-unit) * 12 - env(safe-area-inset-bottom, 0px));
  opacity: 0.55;
  transition: opacity 120ms ease-out;
}
.gg-mc-stick--floating.gg-mc-active .gg-mc-stick-base {
  opacity: 1;
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
  transition: background-color 60ms ease-out;
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
