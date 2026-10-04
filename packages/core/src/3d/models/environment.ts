/**
 * Fog fading distant objects into `color`. `LINEAR` fog starts at `near` and is opaque at `far`;
 * `EXPONENTIAL` fog thickens with distance at the given `density`.
 */
export type Fog3dOpts =
  | { type: 'LINEAR'; color: number; near: number; far: number }
  | { type: 'EXPONENTIAL'; color: number; density: number };

/**
 * Scene-wide environment settings - see `IVisualScene3dComponent.setEnvironment`.
 * @template Tex - The adapter's texture type (`VTypeDoc['texture']`)
 */
export type Environment3dOpts<Tex> = {
  /**
   * What is drawn behind everything: a `0xRRGGBB` color, or a sky texture (a cube texture from
   * `IDisplayObject3dComponentLoader.loadCubeTexture`, or an equirectangular panorama from
   * `loadTexture(url, { mapping: 'equirectangular' })`). `null` shows the renderer's own clear
   * color (`RendererOptions.background`).
   */
  background: number | Tex | null;
  /**
   * Texture lit materials reflect and are lit by (image-based lighting) - same kinds of texture
   * as `background`. Affects `'standart'`-shaded primitives and PBR materials of loaded models.
   * `null` disables it.
   */
  environmentMap: Tex | null;
  /** Fog settings, `null` for no fog. */
  fog: Fog3dOpts | null;
};

/**
 * The six images of a cube-map sky, each named after the world direction it is seen in (the
 * engine is Z-up, so `pz` is the sky overhead and `nz` the ground below).
 */
export type CubeTextureFaces = {
  px: string;
  nx: string;
  py: string;
  ny: string;
  pz: string;
  nz: string;
};

/** Options for `IDisplayObject3dComponentLoader.loadTexture`. */
export type LoadTextureOptions = {
  /**
   * How the texture is projected. `'uv'` (default) is an ordinary texture for a mesh's `diffuse`;
   * `'equirectangular'` is a 2:1 panorama usable as `Environment3dOpts.background`/`environmentMap`,
   * with its horizon along the world's horizontal (XY) plane.
   */
  mapping?: 'uv' | 'equirectangular';
};
