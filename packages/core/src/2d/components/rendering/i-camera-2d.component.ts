import { IDisplayObject2dComponent } from './i-display-object-2d.component';
import { VisualTypeDocRepo2D } from '../../gg-2d-world';

/**
 * Which point of a renderer's view a 2D camera's `position` is: `'center'` (the default) for a
 * camera that follows the action, `'top-left'` for a screen-space layer such as a HUD or a menu,
 * where a camera at `{ x: 0, y: 0 }` puts the world origin at the canvas' top-left corner (y down),
 * one meter covering the visual scene's pixels per meter at `zoom` 1.
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
  /**
   * View magnification, `1` by default: at zoom 1 a texture is drawn at one texel per screen pixel,
   * and a meter covers the visual scene's configured pixels per meter (the texel density it sizes
   * every sprite with; at 100 px per meter a 48x72 px sprite is 0.48x0.72 m and a 2 m wide view is
   * 200 screen pixels at zoom 1). `2` doubles that. The view scales around its `origin` point.
   */
  zoom: number;

  /**
   * The point of the view that `position` is, and that the view zooms and rotates around: its
   * center (`'center'`, the default) or its top-left corner (`'top-left'`). The renderer reads it
   * on every frame, so it can be changed at any time.
   *
   * @example
   * ```ts
   * // a UI layer: world (0, 0) is the canvas' top-left corner, y down; a visual scene configured
   * // with 1 pixel per meter then lays it out in canvas pixels
   * const camera = world.visualScene.factory.createCamera();
   * camera.origin = 'top-left';
   * world.addRenderer(camera, canvas, { transparent: true });
   * ```
   */
  origin: Camera2dOrigin;
}
