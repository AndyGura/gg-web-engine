/**
 * Canvases whose renderer was disposed. Disposing a renderer releases the canvas's WebGL context
 * for good (see `IRendererComponent.dispose`), so such a canvas can't host another renderer.
 */
const releasedCanvases = new WeakSet<HTMLCanvasElement>();

/**
 * Records that the renderer drawing on `canvas` was disposed - called by `IRendererEntity.dispose`.
 * @internal
 */
export function markCanvasReleased(canvas: HTMLCanvasElement | undefined): void {
  if (canvas) {
    releasedCanvases.add(canvas);
  }
}

/**
 * Throws, naming the fix, when `canvas` hosted a renderer that has since been disposed - called by
 * the worlds' `addRenderer` before a renderer is created on it.
 * @internal
 */
export function assertCanvasReusable(canvas: HTMLCanvasElement | undefined): void {
  if (canvas && releasedCanvases.has(canvas)) {
    throw new Error(
      'Cannot add a renderer on this canvas: it hosted a renderer that was disposed, which released its WebGL ' +
        'context for good. Pass replaceCanvas(canvas) (from @gg-web-engine/core) instead - it puts a blank copy of ' +
        'the canvas in its place in the page',
    );
  }
}

/**
 * Puts a blank copy of `canvas` in its place in the page and returns the copy, for the next
 * renderer to draw on. Disposing a renderer releases its canvas's WebGL context right away (a page
 * gets only about 16 contexts, and an app creating a world per game session would run out
 * otherwise), and a released context can't be brought back: one canvas element hosts one renderer.
 * An app that keeps one `<canvas>` in its layout for world after world calls this between the two.
 *
 * The copy keeps the element's id, classes, attributes and inline style, so CSS and layout apply
 * as before; it has no drawing, no context and none of the event listeners added to the original
 * (an input reading the canvas has to be given the new one). Keep the returned element: the
 * original is out of the page from now on. A canvas that isn't in the page is copied as well, and
 * the copy is left out of the page too.
 * @param canvas - The canvas a disposed (or about to be disposed) renderer drew on
 * @returns The fresh canvas, now where `canvas` was
 *
 * @example
 * ```ts
 * let canvas = document.getElementById('gg') as HTMLCanvasElement;
 * // a menu -> game -> menu loop, a new world per game
 * async function startGame() {
 *   const world = createWorld();
 *   await world.init();
 *   canvas = replaceCanvas(canvas);
 *   world.addRenderer(world.visualScene.factory.createPerspectiveCamera(), canvas);
 *   world.start();
 *   return world; // world.dispose() when the game ends
 * }
 * ```
 */
export function replaceCanvas(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const fresh = canvas.cloneNode(false) as HTMLCanvasElement;
  canvas.replaceWith(fresh);
  return fresh;
}
