import { IDisplayObject2dComponent } from './i-display-object-2d.component';
import { VisualTypeDocRepo2D } from '../../gg-2d-world';

/**
 * Which point of a renderer's view a 2D camera's `position` is: `'center'` (the default) for a
 * camera that follows the action, `'top-left'` for a screen-space layer such as a HUD or a menu,
 * where a camera at `{ x: 0, y: 0 }` with `zoom` 1 makes world coordinates canvas pixels (y down).
 */
export type Camera2dOrigin = 'center' | 'top-left';

/**
 * A 2D camera, created by `IDisplayObject2dComponentFactory.createCamera()` and passed to
 * `Gg2dWorld.addRenderer`, which wraps it in a `Renderer2dEntity` (whose `position`/`rotation` are
 * the camera's).
 */
export interface ICamera2dComponent<
  VTypeDoc extends VisualTypeDocRepo2D = VisualTypeDocRepo2D,
> extends IDisplayObject2dComponent<VTypeDoc> {
  /** Screen pixels per world unit, `1` by default. The view scales around its `origin` point. */
  zoom: number;

  /**
   * The point of the view that `position` is, and that the view zooms and rotates around: its
   * center (`'center'`, the default) or its top-left corner (`'top-left'`). The renderer reads it
   * on every frame, so it can be changed at any time.
   *
   * @example
   * ```ts
   * // a UI layer: world (0, 0) is the canvas' top-left corner, 1 world unit = 1 px, y down
   * const camera = world.visualScene.factory.createCamera();
   * camera.origin = 'top-left';
   * world.addRenderer(camera, canvas, { transparent: true });
   * ```
   */
  origin: Camera2dOrigin;
}
