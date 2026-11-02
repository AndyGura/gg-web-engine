import { Container } from 'pixi.js';

/**
 * The scene's world container (`PixiSceneComponent.nativeContainer`) is the frame the engine's
 * world coordinates live in: every renderer scales it by `zoom * pixelsPerMeter` and pivots it on
 * its camera right before drawing. Marking it lets a display object tell where its own world
 * frame ends when it computes bounds (see `PixiDisplayObjectComponent.getBoundings`), without
 * knowing the scene.
 */
const worldContainers = new WeakSet<Container>();

export function markWorldContainer(container: Container): void {
  worldContainers.add(container);
}

export function isWorldContainer(container: Container): boolean {
  return worldContainers.has(container);
}
