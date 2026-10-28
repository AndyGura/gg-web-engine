import { IRendererEntity, Point3, Point4, RenderLayer } from '../../base';
import { IPositionable3d } from '../interfaces/i-positionable-3d';
import { VisualTypeDocRepo3D } from '../gg-3d-world';
import { IFrameSwitchable, switchPoseFrame } from '../interfaces/i-frame-switchable';
import { Frame3d } from '../models/frame-3d';

export class Renderer3dEntity<VTypeDoc extends VisualTypeDocRepo3D = VisualTypeDocRepo3D>
  extends IRendererEntity<Point3, Point4, VTypeDoc>
  implements IPositionable3d, IFrameSwitchable
{
  static readonly entityTypeName: string = 'Renderer3dEntity';

  /**
   * `IFrameSwitchable`: moves the camera by `delta` (once, also when a `Camera3dEntity` wraps the
   * same camera), so the next frame is drawn from the same global viewpoint.
   */
  public onFrameSwitch(delta: Frame3d): void {
    switchPoseFrame(this.camera, delta);
  }

  /**
   * Proxies to `this.camera.enableRenderLayer`/`disableRenderLayer`/`isRenderLayerEnabled` - see
   * `ICamera3dComponent`'s own doc for what enabling/disabling a render layer on a camera means.
   * Mirrors the inherited `position`/`rotation` accessors (`IRendererEntity`), which proxy to the
   * same underlying `camera` for the same reason: call sites driving a renderer/its camera (e.g.
   * `PlayerCharacterController`) shouldn't need to reach through `this.camera.camera` just because
   * this one concept doesn't already have its own top-level accessor the way position/rotation do.
   */
  enableRenderLayer(layer: RenderLayer): void {
    this.camera.enableRenderLayer(layer);
  }

  /** See `enableRenderLayer`'s own doc. */
  disableRenderLayer(layer: RenderLayer): void {
    this.camera.disableRenderLayer(layer);
  }

  /** See `enableRenderLayer`'s own doc. */
  isRenderLayerEnabled(layer: RenderLayer): boolean {
    return this.camera.isRenderLayerEnabled(layer);
  }
}
