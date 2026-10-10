/**
 * One sprite region of a particle texture (an atlas), in normalized texture coordinates with the
 * origin at the image's top-left corner and `y` going down, like the image file itself: `x`/`y` is
 * the region's top-left corner, `width`/`height` its size, each from `0` to `1`. Regions may differ
 * in size and aspect; the drawn quad's size comes from the particle (`Particle.size`), so give a
 * non-square region a non-square particle size to keep its aspect.
 */
export type ParticleFrame = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

/** The whole texture as one frame - the default when a system defines no `frames`. */
export const FULL_PARTICLE_FRAME: ParticleFrame = { x: 0, y: 0, width: 1, height: 1 };

/** Helpers building `ParticleFrame` lists. */
export class ParticleFrames {
  /**
   * The cells of a uniform grid atlas, row by row from the top-left one.
   * @param columns - Cells per row
   * @param rows - Rows of cells
   * @param count - How many cells to return (default: all of them), for a last row that isn't full
   */
  static grid(columns: number, rows: number, count: number = columns * rows): ParticleFrame[] {
    const frames: ParticleFrame[] = [];
    for (let i = 0; i < count; i++) {
      const column = i % columns;
      const row = Math.floor(i / columns);
      frames.push({ x: column / columns, y: row / rows, width: 1 / columns, height: 1 / rows });
    }
    return frames;
  }

  /**
   * Regions given in pixels of a texture of `textureWidth` x `textureHeight` pixels, e.g. sprites of
   * different sizes packed into one atlas.
   */
  static fromPixels(
    regions: readonly { x: number; y: number; width: number; height: number }[],
    textureWidth: number,
    textureHeight: number,
  ): ParticleFrame[] {
    return regions.map(r => ({
      x: r.x / textureWidth,
      y: r.y / textureHeight,
      width: r.width / textureWidth,
      height: r.height / textureHeight,
    }));
  }
}
