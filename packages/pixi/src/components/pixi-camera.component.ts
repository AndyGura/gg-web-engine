import { Camera2dOrigin, ICamera2dComponent, Point2 } from '@gg-web-engine/core';
import { Container } from 'pixi.js';
import { PixiDisplayObjectComponent } from './pixi-display-object.component';
import { PixiVisualTypeDocRepo2D } from '../types';

/**
 * The pixi.js `ICamera2dComponent`, built by `PixiFactory.createCamera()`. At `zoom` 1 a meter of
 * the world covers `pixelsPerMeter` screen pixels (the scene's texel density); `zoom` multiplies
 * that.
 */
export class PixiCameraComponent
  extends PixiDisplayObjectComponent
  implements ICamera2dComponent<PixiVisualTypeDocRepo2D>
{
  public zoom: number = 1;

  /** See `ICamera2dComponent.origin`; `PixiRendererComponent.render` reads it on every frame. */
  public origin: Camera2dOrigin = 'center';

  /**
   * Screen pixels per meter at `zoom` 1. The renderer drawing through this camera sets it to its
   * scene's `pixelsPerMeter` (on construction and before every frame), so `worldToScreen`/
   * `screenToWorld` always agree with what is drawn; until a renderer has, it is the value of the
   * factory that built the camera.
   */
  public pixelsPerMeter: number;

  /** @param pixelsPerMeter - The factory's `pixelsPerMeter`, the value until a renderer draws through this camera. */
  constructor(pixelsPerMeter: number = 100) {
    super(new Container());
    this.pixelsPerMeter = pixelsPerMeter;
  }

  /**
   * The screen offset, in pixels from the point the camera's `origin` names, of a world point in
   * meters: `(world - position) * zoom * pixelsPerMeter`. Ignores the camera's rotation.
   */
  public worldToScreen(worldPoint: Point2): Point2 {
    const k = this.zoom * this.pixelsPerMeter;
    return {
      x: (worldPoint.x - this.position.x) * k,
      y: (worldPoint.y - this.position.y) * k,
    };
  }

  /** The inverse of `worldToScreen`: a screen offset in pixels to a world point in meters. */
  public screenToWorld(screenPoint: Point2): Point2 {
    const k = this.zoom * this.pixelsPerMeter;
    return {
      x: screenPoint.x / k + this.position.x,
      y: screenPoint.y / k + this.position.y,
    };
  }
}
