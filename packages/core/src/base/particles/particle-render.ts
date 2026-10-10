import { Point3 } from '../models/points';

/**
 * How a particle sprite is combined with what is already drawn behind it. Every mode multiplies the
 * texture with the particle's tint, and `alpha` below is the texture's alpha (see
 * `ParticleSystemRenderOptions.textureAlpha`) times the particle's opacity:
 * - `'normal'`: `color * alpha + behind * (1 - alpha)` - ordinary transparency.
 * - `'additive'`: `color * alpha + behind` - light, fire, sparks; a black background in the
 *   texture adds nothing, so an opaque sprite drawn on black needs no alpha channel.
 * - `'multiply'`: `behind * mix(1, color, alpha)` - darkens, e.g. soot.
 * - `'subtractive'`: `behind * (1 - color * alpha)` - darkens by the sprite's brightness.
 * - `'premultiplied'`: `color * opacity + behind * (1 - alpha)` - the texture's color is taken as
 *   already weighted by its alpha. With `textureAlpha: 'brightness'` this is a translucency-table
 *   look for a grey sprite on an opaque black background: black leaves the background untouched,
 *   grey both covers it partly and adds its own brightness.
 *
 * Anything else (a game's exact palette translucency table, custom blend equations) goes through the
 * rendering adapter's own material hook - see the adapter's particle system options.
 */
export type ParticleBlendMode = 'normal' | 'additive' | 'multiply' | 'subtractive' | 'premultiplied';

/** Rendering settings of a particle system that every dimension shares. */
export type ParticleSystemRenderOptions<Tex = unknown> = {
  /** Most particles alive at once. The simulation and the render buffers are sized for it up front. */
  capacity: number;
  /** The sprite texture (or atlas, see `ParticleFrame`). None: a plain white quad, tinted. */
  texture?: Tex | null;
  /** Default `'normal'`. */
  blending?: ParticleBlendMode;
  /**
   * Where a texel's alpha comes from: `'alpha'` (default) is the texture's alpha channel;
   * `'brightness'` is its brightest color channel (as stored in the image, before any color space
   * conversion) times its alpha - for sprites drawn on an opaque black background, which then
   * becomes transparent.
   */
  textureAlpha?: 'alpha' | 'brightness';
  /** Fragments whose final alpha is at or below this are discarded (no depth write, no blend). Default `0`. */
  alphaTest?: number;
};

/**
 * The particles to draw, written by `ParticleSimulation.writeRenderBuffers` and read by a rendering
 * adapter. The arrays are allocated once for `capacity` particles and reused every frame; only the
 * first `count` entries are valid, in spawn order (oldest first). An adapter may keep a reference to
 * this object and read it whenever it draws.
 */
export type ParticleRenderBuffers = {
  readonly capacity: number;
  /** Values per particle in `position`: `3` in 3D, `2` in 2D. */
  readonly dimensions: 2 | 3;
  /** Particles to draw. */
  count: number;
  /** Sprite centers, `dimensions` floats per particle, in the space the system simulates in. */
  readonly position: Float32Array;
  /** Sprite width and height in world units, 2 floats per particle. */
  readonly size: Float32Array;
  /** Sprite rotation in radians (see `Particle.rotation` for the sign), 1 float per particle. */
  readonly rotation: Float32Array;
  /** Tint red, green, blue (`0`..`1`, sRGB like the `0xRRGGBB` it came from) and opacity, 4 floats per particle. */
  readonly color: Float32Array;
  /**
   * The atlas region: `x`, `y` (top-left corner, image coordinates with `y` down), `width`,
   * `height`, normalized - see `ParticleFrame`. 4 floats per particle.
   */
  readonly uv: Float32Array;
  /** `Particle.shaderData`, 4 floats per particle, for custom materials. */
  readonly extra: Float32Array;
};

export function createParticleRenderBuffers(capacity: number, dimensions: 2 | 3): ParticleRenderBuffers {
  return {
    capacity,
    dimensions,
    count: 0,
    position: new Float32Array(capacity * dimensions),
    size: new Float32Array(capacity * 2),
    rotation: new Float32Array(capacity),
    color: new Float32Array(capacity * 4),
    uv: new Float32Array(capacity * 4),
    extra: new Float32Array(capacity * 4),
  };
}

/**
 * Orders the particles of a 3D `buffers` from the farthest to the nearest, for drawing transparent
 * sprites back to front. Depth is measured along `viewDirection` (the way the camera looks) from
 * `viewPoint` (the camera position), both in the space of `buffers.position` - the depth a
 * perspective and an orthographic camera both sort by. Equal depths keep spawn order (older first).
 * @param indices - Receives the sorted particle indices in its first `buffers.count` entries; at
 * least `buffers.count` long
 * @param depths - Scratch space, at least `buffers.count` long
 */
export function sortParticlesBackToFront(
  buffers: ParticleRenderBuffers,
  viewPoint: Point3,
  viewDirection: Point3,
  indices: Uint32Array,
  depths: Float32Array,
): void {
  const n = buffers.count;
  const p = buffers.position;
  for (let i = 0; i < n; i++) {
    const o = i * 3;
    depths[i] =
      (p[o] - viewPoint.x) * viewDirection.x +
      (p[o + 1] - viewPoint.y) * viewDirection.y +
      (p[o + 2] - viewPoint.z) * viewDirection.z;
    indices[i] = i;
  }
  indices.subarray(0, n).sort((a, b) => depths[b] - depths[a] || a - b);
}
