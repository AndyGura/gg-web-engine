import { Point2 } from '../../models/points';
import { Observable } from 'rxjs';
import { IWorldComponent } from '../i-world-component';
import { GgWorld, GgWorldTypeDocVPatch, VisualTypeDocRepo } from '../../gg-world';
import { IEntity } from '../../entities/i-entity';
import { IVisualSceneComponent } from './i-visual-scene.component';

/**
 * Represents the options that can be passed to a renderer.
 * @typedef {Object} RendererOptions
 * @property {boolean} transparent - Specifies whether pixels can be transparent. false by default.
 * @property {number} background - Specifies the background color of the renderer. black by default.
 * @property {Point2 | 'fullscreen' | ((pageSize: Point2) => Point2) | Observable<Point2>} size - Specifies the size of the renderer and canvas if set, in CSS pixels. 'fullscreen' by default: the page's visible area, measured with `measureViewport` and followed with `viewportSize$`; the function form maps that same measurement.
 * @property {number | Observable<number>} [forceResolution] - Specifies the pixel resolution (render pixels per CSS pixel). Not set by default, which means "use device resolution". An observable changes it live, e.g. from a game's resolution setting: every value it emits while the renderer entity is in a world is applied with `setResolution`, keeping the renderer's size; until its first value the device resolution is used.
 * @property {boolean} antialias - Specifies whether antialiasing is turned on/off. true by default.
 */
export type RendererOptions = {
  transparent: boolean;
  background: number;
  size: Point2 | 'fullscreen' | ((pageSize: Point2) => Point2) | Observable<Point2>;
  forceResolution?: number | Observable<number>;
  antialias: boolean;
};

const DEFAULT_RENDERER_OPTIONS: RendererOptions = {
  transparent: false,
  background: 0x000000,
  size: 'fullscreen',
  antialias: true,
};

export abstract class IRendererComponent<
  D,
  R,
  VTypeDoc extends VisualTypeDocRepo<D, R> = VisualTypeDocRepo<D, R>,
> implements IWorldComponent<D, R, GgWorldTypeDocVPatch<D, R, VTypeDoc>> {
  entity: IEntity | null = null;

  abstract camera: VTypeDoc['camera'];

  /** Specifies the options for the renderer. */
  public readonly rendererOptions: RendererOptions & Partial<VTypeDoc['rendererExtraOpts']>;

  /** get flag whether renderer shows physics debugger view */
  abstract get physicsDebugViewActive(): boolean;
  /** turns on/off physics debugger view for this renderer */
  abstract set physicsDebugViewActive(value: boolean);

  protected constructor(
    public readonly scene: IVisualSceneComponent<D, R, VTypeDoc>,
    public readonly canvas?: HTMLCanvasElement,
    options: Partial<RendererOptions & VTypeDoc['rendererExtraOpts']> = {},
  ) {
    this.rendererOptions = {
      ...DEFAULT_RENDERER_OPTIONS,
      ...(options || {}),
    };
  }

  /**
   * Renders the scene.
   */
  abstract render(): void;

  abstract addToWorld(world: GgWorld<D, R, GgWorldTypeDocVPatch<D, R, VTypeDoc>>): void;

  abstract removeFromWorld(world: GgWorld<D, R, GgWorldTypeDocVPatch<D, R, VTypeDoc>>, dispose?: boolean): void;

  /**
   * The resolution a renderer starts with: `forceResolution` when it is a number, otherwise the
   * device resolution (`devicePixelRatio`, or 1 where there is none). An observable
   * `forceResolution` takes over once it emits (see {@link setResolution}).
   */
  protected get initialResolution(): number {
    const forced = this.rendererOptions.forceResolution;
    if (typeof forced === 'number' && forced > 0) {
      return forced;
    }
    return (typeof devicePixelRatio === 'number' && devicePixelRatio > 0 && devicePixelRatio) || 1;
  }

  /**
   * Changes the pixel resolution (render pixels per CSS pixel) without recreating the renderer.
   * The size in CSS pixels stays the same; the drawing buffer, and anything else the renderer owns
   * that is sized by it, is resized to match. `IRendererEntity` calls it with every value an
   * observable `forceResolution` emits.
   * @param resolution the new resolution, greater than 0
   */
  abstract setResolution(resolution: number): void;

  /**
   * Resizes the renderer to the specified size.
   * @param {Point2} newSize - The new size of the renderer.
   */
  abstract resizeRenderer(newSize: Point2): void;

  /**
   * Frees the renderer and releases its canvas's WebGL context right away, not at garbage
   * collection: a page gets only about 16 contexts, and an app creating a world per game session
   * would run out. A released context can't be brought back, so the canvas can't host another
   * renderer - `replaceCanvas(canvas)` swaps in a blank copy for the next one.
   */
  abstract dispose(): void;
}
