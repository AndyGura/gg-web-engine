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
   *
   * @example
   * ```ts
   * // a 4x1 strip of dust-puff frames, played over each particle's life
   * const dust = world.addParticleSystem(
   *   { capacity: 64, texture: dustStrip },
   *   { lifetime: 0.5, size: 24, frames: ParticleFrames.grid(4, 1), frameSequence: [0, 1, 2, 3] },
   * );
   * ```
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
   *
   * @example
   * ```ts
   * // two sprites of different sizes packed into a 128x64 px atlas; each particle picks one
   * const frames = ParticleFrames.fromPixels(
   *   [
   *     { x: 0, y: 0, width: 64, height: 64 },
   *     { x: 64, y: 0, width: 64, height: 32 },
   *   ],
   *   128,
   *   64,
   * );
   * const debris = world.addParticleSystem({ capacity: 100, texture: atlas }, { frames, lifetime: 2 });
   * debris.emit(10, (p, ctx) => {
   *   p.frame = ctx.random() < 0.5 ? 0 : 1;
   * });
   * ```
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
