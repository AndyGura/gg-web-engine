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
 * @property {Point2 | 'fullscreen' | ((pageSize: Point2) => Point2) | Observable<Point2>} size - Specifies the size of the renderer and canvas if set. 'fullscreen' by default.
 * @property {number} [forceResolution] - Specifies the pixel resolution. Not set by default, which means "use device resolution".
 * @property {boolean} antialias - Specifies whether antialiasing is turned on/off. true by default.
 */
export type RendererOptions = {
  transparent: boolean;
  background: number;
  size: Point2 | 'fullscreen' | ((pageSize: Point2) => Point2) | Observable<Point2>;
  forceResolution?: number;
  antialias: boolean;
};

const DEFAULT_RENDERER_OPTIONS: RendererOptions = {
  transparent: false,
  background: 0x000000,
  size: 'fullscreen',
  antialias: true,
};

export abstract class IRendererComponent<D, R, VTypeDoc extends VisualTypeDocRepo<D, R> = VisualTypeDocRepo<D, R>>
  implements IWorldComponent<D, R, GgWorldTypeDocVPatch<D, R, VTypeDoc>>
{
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

  abstract removeFromWorld(world: GgWorld<D, R, GgWorldTypeDocVPatch<D, R, VTypeDoc>>): void;

  /**
   * Resizes the renderer to the specified size.
   * @param {Point2} newSize - The new size of the renderer.
   */
  abstract resizeRenderer(newSize: Point2): void;

  abstract dispose(): void;
}
