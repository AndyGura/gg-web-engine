import { IRendererComponent, IVisualSceneComponent, Point3, Point4, RendererOptions } from '../../../base';
import { VisualTypeDocRepo3D } from '../../gg-3d-world';

/**
 * The options of a 3D renderer (`Gg3dWorld.addRenderer`): the shared `RendererOptions` plus the
 * ones only a 3D world has.
 * @typedef {Object} Renderer3dOptions
 * @property {boolean} drawBackdrops - Whether the renderer draws the world's backdrops
 * (`Gg3dWorld.backdrops`) behind the world. true by default. With false it draws what it would in a
 * world without backdrops: the world scene alone, under the world's own sky
 * (`environment.background`, a procedural sky included) - for a second view that must not show
 * them, such as a rear-view mirror. The renderer's `drawBackdrops` reads and changes this option.
 */
export type Renderer3dOptions = RendererOptions & {
  drawBackdrops: boolean;
};

const NO_BACKDROPS: ReadonlyArray<never> = [];

export abstract class IRenderer3dComponent<
  VTypeDoc extends VisualTypeDocRepo3D = VisualTypeDocRepo3D,
> extends IRendererComponent<Point3, Point4, VTypeDoc> {
  declare public readonly rendererOptions: Renderer3dOptions & Partial<VTypeDoc['rendererExtraOpts']>;

  /**
   * Whether this renderer draws the world's backdrops (`Gg3dWorld.backdrops`, see
   * `Backdrop3dEntity`) behind the world. Off, it draws the world scene alone, with the world's own
   * sky, as in a world without backdrops; the other renderers of the world are not affected.
   * It is `rendererOptions.drawBackdrops` (true by default), so the options always describe the
   * renderer as it is. It can be changed at any time: the next frame follows it.
   */
  public get drawBackdrops(): boolean {
    return this.rendererOptions.drawBackdrops;
  }

  public set drawBackdrops(value: boolean) {
    if (this.rendererOptions.drawBackdrops === value) {
      return;
    }
    this.rendererOptions.drawBackdrops = value;
    this.onDrawBackdropsChanged();
  }

  protected constructor(
    scene: IVisualSceneComponent<Point3, Point4, VTypeDoc>,
    canvas?: HTMLCanvasElement,
    options: Partial<Renderer3dOptions & VTypeDoc['rendererExtraOpts']> = {},
  ) {
    const withDefaults: Partial<Renderer3dOptions & VTypeDoc['rendererExtraOpts']> = {
      ...options,
      drawBackdrops: options?.drawBackdrops ?? true,
    };
    super(scene, canvas, withDefaults);
  }

  /**
   * Called after `drawBackdrops` changed. An adapter that holds something per backdrop only while
   * it draws backdrops (GPU uploads, render passes) sets it up or frees it here.
   */
  protected onDrawBackdropsChanged(): void {}

  /**
   * The backdrops this renderer draws, farthest first: `world.backdrops` while `drawBackdrops` is
   * on, none while it is off or outside a world. An adapter reads backdrops through this, never
   * `world.backdrops` directly, so a renderer with `drawBackdrops` off can't draw, pose or prepare
   * one by accident.
   */
  protected backdropsToDraw<B>(world: { readonly backdrops: ReadonlyArray<B> } | null | undefined): ReadonlyArray<B> {
    return (this.drawBackdrops && world?.backdrops) || NO_BACKDROPS;
  }
}
