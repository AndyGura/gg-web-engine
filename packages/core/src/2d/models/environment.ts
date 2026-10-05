import { Point2 } from '../../base';

/**
 * Scene-wide environment settings for a 2D world - see `IVisualScene2dComponent.setEnvironment`.
 * @template Tex - The adapter's texture type (`VTypeDoc['texture']`)
 */
export type Environment2dOpts<Tex> = {
  /**
   * What is drawn behind everything, fixed to the screen: a `0xRRGGBB` color, or an image scaled to
   * cover the whole view (keeping its aspect ratio, cropping the overflow). `null` shows the
   * renderer's own clear color (`RendererOptions.background`). For a backdrop that scrolls or
   * repeats, use a parallax layer instead (`IDisplayObject2dComponentFactory.createParallaxLayer`).
   */
  background: number | Tex | null;
};

/** Which axes a parallax layer's texture repeats along. */
export type ParallaxLayer2dRepeat = 'x' | 'y' | 'both' | 'none';

/**
 * Settings for a parallax layer - a texture drawn behind (or in front of) the world that scrolls at
 * a different rate than the world as the camera moves. See
 * `IDisplayObject2dComponentFactory.createParallaxLayer`.
 * @template Tex - The adapter's texture type (`VTypeDoc['texture']`)
 */
export type ParallaxLayer2dOpts<Tex> = {
  texture: Tex;
  /**
   * How fast the layer moves relative to the world as the camera moves, per axis (a single number
   * applies to both). `0` stays fixed on screen (a far sky), `1` moves with the world, values in
   * between read as distance (smaller is farther), and values above `1` suit close foreground
   * layers. Default `0.5`.
   */
  parallax?: Point2 | number;
  /** Draw order relative to every other display object (see `IDisplayObject2dComponent.zIndex`).
   * Negative is behind the world's default `0`. Default `-1`. */
  zIndex?: number;
  /** Axes the texture repeats along. A non-repeating axis shows the texture once. Default `'x'`. */
  repeat?: ParallaxLayer2dRepeat;
  /** World position of the texture's top-left corner while the camera is at the origin. Default `{ x: 0, y: 0 }`. */
  offset?: Point2;
  /** World units per texture pixel, per axis (a single number applies to both). Default `1`. */
  scale?: Point2 | number;
};

/** `ParallaxLayer2dOpts` with every default filled in and per-axis values spelled out. */
export type ResolvedParallaxLayer2dOpts<Tex> = {
  texture: Tex;
  parallax: Point2;
  zIndex: number;
  repeat: ParallaxLayer2dRepeat;
  offset: Point2;
  scale: Point2;
};

/** Fills in `ParallaxLayer2dOpts` defaults - shared by adapters so they all agree on them. */
export function resolveParallaxLayer2dOpts<Tex>(options: ParallaxLayer2dOpts<Tex>): ResolvedParallaxLayer2dOpts<Tex> {
  const perAxis = (v: Point2 | number | undefined, d: number): Point2 =>
    v === undefined ? { x: d, y: d } : typeof v === 'number' ? { x: v, y: v } : { x: v.x, y: v.y };
  return {
    texture: options.texture,
    parallax: perAxis(options.parallax, 0.5),
    zIndex: options.zIndex ?? -1,
    repeat: options.repeat ?? 'x',
    offset: perAxis(options.offset, 0),
    scale: perAxis(options.scale, 1),
  };
}
