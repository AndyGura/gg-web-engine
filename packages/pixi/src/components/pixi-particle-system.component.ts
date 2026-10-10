import {
  IParticleSystem2dComponent,
  ParticleBlendMode2d,
  ParticleRenderBuffers,
  ParticleSystem2dRenderOptions,
} from '@gg-web-engine/core';
import { BLEND_MODES, IParticle, ParticleContainer, Rectangle, Texture } from 'pixi.js';
import { PixiDisplayObjectComponent } from './pixi-display-object.component';
import { PixiVisualTypeDocRepo2D } from '../types';

/**
 * pixi.js-only particle system options, merged into `ParticleSystem2dRenderOptions` when creating a
 * system (`factory.createParticleSystem` / `world.addParticleSystem`).
 */
export type PixiParticleSystemExtraOpts = {
  /**
   * Whether sprite positions are rounded to whole pixels (crisp pixel art). Default `false`.
   *
   * @example
   * ```ts
   * world.addParticleSystem({ capacity: 64, texture: pixelDust, roundPixels: true }, { lifetime: 0.4 });
   * ```
   */
  roundPixels?: boolean;
};

const BLEND_MODE: Record<ParticleBlendMode2d, BLEND_MODES> = {
  normal: 'normal',
  additive: 'add',
  multiply: 'multiply',
};

/**
 * The pixi.js `IParticleSystem2dComponent`: a `ParticleContainer` whose `particleChildren` are
 * `capacity` pooled plain `IParticle` records, refilled from core's `ParticleRenderBuffers` on every
 * `setParticles` - position, scale (the particle's size in world units over the frame's size in
 * pixels), rotation, packed tint and opacity, and the atlas region as a sub-texture of the system's
 * texture (one `Texture` per distinct region, created on demand and shared by every particle
 * showing it). Every property is dynamic, so the container re-uploads them each frame. The
 * container's own `tint`/`opacity` multiply the particles' (inherited, like any pixi container).
 *
 * pixi's `ParticleContainer` never computes bounds itself, so `getBoundings` reports whatever
 * `nativeSprite.boundsArea` was set to (an empty box by default).
 */
export class PixiParticleSystemComponent
  extends PixiDisplayObjectComponent
  implements IParticleSystem2dComponent<PixiVisualTypeDocRepo2D>
{
  public readonly nativeSprite!: ParticleContainer;
  public readonly capacity: number;

  private readonly _renderOptions: ParticleSystem2dRenderOptions<Texture> & PixiParticleSystemExtraOpts;
  public get renderOptions(): Readonly<ParticleSystem2dRenderOptions<Texture>> {
    return this._renderOptions;
  }

  private readonly pool: IParticle[] = [];
  /** sub-textures of the current texture by atlas region, see `frameTexture` */
  private readonly frameTextures: Map<string, Texture> = new Map();

  constructor(options: ParticleSystem2dRenderOptions<Texture> & PixiParticleSystemExtraOpts) {
    const capacity = options.capacity;
    if (!(capacity > 0) || !Number.isInteger(capacity)) {
      throw new Error(`Particle system capacity must be a positive integer, got ${capacity}`);
    }
    const texture = options.texture ?? Texture.WHITE;
    const container = new ParticleContainer({
      texture,
      dynamicProperties: { vertex: true, position: true, rotation: true, uvs: true, color: true },
      roundPixels: options.roundPixels ?? false,
    });
    container.blendMode = BLEND_MODE[options.blending ?? 'normal'];
    container.zIndex = options.zIndex ?? 0;
    super(container);
    this.capacity = capacity;
    this._renderOptions = { ...options };
    for (let i = 0; i < capacity; i++) {
      this.pool.push({
        x: 0,
        y: 0,
        scaleX: 1,
        scaleY: 1,
        anchorX: 0.5,
        anchorY: 0.5,
        rotation: 0,
        color: 0xffffffff,
        texture,
      });
    }
  }

  public get texture(): Texture | null {
    return this._renderOptions.texture ?? null;
  }

  public set texture(value: Texture | null) {
    this._renderOptions.texture = value;
    this.disposeFrameTextures();
    const texture = value ?? Texture.WHITE;
    this.nativeSprite.texture = texture;
    for (const p of this.pool) {
      p.texture = texture;
    }
    this.nativeSprite.update();
  }

  setParticles(buffers: ParticleRenderBuffers): void {
    if (buffers.capacity > this.capacity) {
      throw new Error(
        `Particle buffers for ${buffers.capacity} particles don't fit a system of capacity ${this.capacity}`,
      );
    }
    if (buffers.dimensions !== 2) {
      throw new Error('A 2D particle system needs 2D particle buffers');
    }
    const n = buffers.count;
    const children = this.nativeSprite.particleChildren;
    children.length = n;
    for (let i = 0; i < n; i++) {
      const p = this.pool[i];
      const c = i * 4;
      p.x = buffers.position[i * 2];
      p.y = buffers.position[i * 2 + 1];
      const texture = this.frameTexture(buffers.uv[c], buffers.uv[c + 1], buffers.uv[c + 2], buffers.uv[c + 3]);
      p.texture = texture;
      p.scaleX = buffers.size[i * 2] / texture.orig.width;
      p.scaleY = buffers.size[i * 2 + 1] / texture.orig.height;
      p.rotation = buffers.rotation[i];
      // pixi packs a particle's color as ABGR: alpha in the top byte, then blue, green, red
      const r = Math.round(buffers.color[c] * 255);
      const g = Math.round(buffers.color[c + 1] * 255);
      const b = Math.round(buffers.color[c + 2] * 255);
      const a = Math.round(buffers.color[c + 3] * 255);
      p.color = ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
      children[i] = p;
    }
    this.nativeSprite.update();
  }

  /**
   * The sub-texture of the system's texture showing the atlas region (normalized, top-left origin),
   * the texture itself for the whole image.
   */
  private frameTexture(x: number, y: number, width: number, height: number): Texture {
    const base = this.nativeSprite.texture;
    if (x === 0 && y === 0 && width === 1 && height === 1) {
      return base;
    }
    const key = `${x},${y},${width},${height}`;
    let texture = this.frameTextures.get(key);
    if (!texture) {
      const frame = base.frame;
      texture = new Texture({
        source: base.source,
        frame: new Rectangle(
          frame.x + x * frame.width,
          frame.y + y * frame.height,
          width * frame.width,
          height * frame.height,
        ),
      });
      this.frameTextures.set(key, texture);
    }
    return texture;
  }

  private disposeFrameTextures(): void {
    for (const texture of this.frameTextures.values()) {
      // the source belongs to the system's texture
      texture.destroy(false);
    }
    this.frameTextures.clear();
  }

  clone(): PixiParticleSystemComponent {
    const copy = new PixiParticleSystemComponent(this._renderOptions);
    copy.position = this.position;
    copy.rotation = this.rotation;
    copy.visible = this.visible;
    copy.zIndex = this.zIndex;
    copy.tint = this.tint;
    copy.opacity = this.opacity;
    return copy;
  }

  popChild(): null {
    return null;
  }

  dispose(): void {
    this.disposeFrameTextures();
    this.nativeSprite.particleChildren.length = 0;
    // the texture belongs to whoever loaded it
    this.nativeSprite.destroy({ texture: false });
  }
}
