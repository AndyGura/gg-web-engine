const svg = (body: string) => `<svg viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;

/**
 * The built-in icons, as inline SVG markup drawn with `currentColor`. Pass any of them (or any other
 * markup, or a DOM node) as a `TouchButton`'s `content`.
 */
export const MobileControlsIcons = {
  left: svg('<path d="M15 5l-7 7 7 7"/>'),
  right: svg('<path d="M9 5l7 7-7 7"/>'),
  up: svg('<path d="M5 15l7-7 7 7"/>'),
  down: svg('<path d="M5 9l7 7 7-7"/>'),
  accelerate: svg('<path d="M6 12l6-6 6 6M6 19l6-6 6 6"/>'),
  brake: svg(
    '<circle cx="12" cy="12" r="6"/><path d="M4.5 6a10 10 0 0 0 0 12M19.5 6a10 10 0 0 1 0 12M12 9v3.5M12 15h.01"/>',
  ),
  handbrake: svg(
    '<circle cx="12" cy="12" r="6"/><path d="M4.5 6a10 10 0 0 0 0 12M19.5 6a10 10 0 0 1 0 12M10.5 15V9h1.75a1.75 1.75 0 0 1 0 3.5H10.5"/>',
  ),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  minus: svg('<path d="M5 12h14"/>'),
  jump: svg('<path d="M12 16V4M7 9l5-5 5 5M5 20h14"/>'),
  crouch: svg('<path d="M12 4v12M7 11l5 5 5-5M5 20h14"/>'),
  run: svg('<path d="M5 6l6 6-6 6M13 6l6 6-6 6"/>'),
  view: svg('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
};
