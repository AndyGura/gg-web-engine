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
  brake: svg('<path d="M6 5l6 6 6-6M6 12l6 6 6-6"/>'),
  handbrake: svg(
    '<circle cx="12" cy="12" r="6"/><path d="M4.5 6a10 10 0 0 0 0 12M19.5 6a10 10 0 0 1 0 12M10.5 15V9h1.75a1.75 1.75 0 0 1 0 3.5H10.5"/>',
  ),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  minus: svg('<path d="M5 12h14"/>'),
  jump: svg('<path d="M12 16V4M7 9l5-5 5 5M5 20h14"/>'),
  crouch: svg('<path d="M12 4v12M7 11l5 5 5-5M5 20h14"/>'),
  run: svg('<path d="M5 6l6 6-6 6M13 6l6 6-6 6"/>'),
  view: svg('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
  // an open hand reaching for something
  grab: svg(
    '<path d="M8 13V6a1.5 1.5 0 013 0v6M11 11V4a1.5 1.5 0 013 0v7M14 12V6a1.5 1.5 0 013 0v8M5 12l3 1M8 13c-2 2-3 3.5-2 6 1 2 3 2 7 2s5-1 5-5v-2"/>',
  ),
  // the hand letting go: fingers apart, the object falling away
  release: svg(
    '<path d="M8 11V6a1.5 1.5 0 013 0v5M11 10V4a1.5 1.5 0 013 0v6M14 11V6a1.5 1.5 0 013 0v5M8 11c-2 1-3 2-2 4 1 1 3 1 7 1s5-1 5-4"/><path d="M12 18v4M9 21l3 1 3-1"/>',
  ),
  // an object flung forward
  throw: svg('<circle cx="17" cy="7" r="2.5"/><path d="M4 18c3-6 7-9 11-10M5 14l-1 4 4 1"/>'),
};
