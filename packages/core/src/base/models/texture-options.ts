/**
 * How a texture is sampled when drawn bigger or smaller than its own resolution: `linear` smooths
 * between texels (the default, right for photos and painted art), `nearest` picks the closest texel
 * and keeps hard pixel edges (right for pixel art).
 */
export type TextureFilter = 'linear' | 'nearest';

/** Options for loading or creating a texture, shared by 2D and 3D factories. */
export type TextureOptions = {
  /** See `TextureFilter`. Default `linear`. */
  filter?: TextureFilter;
};
