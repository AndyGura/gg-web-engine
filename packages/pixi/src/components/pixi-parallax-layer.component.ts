import {
  IParallaxLayer2dComponent,
  ParallaxLayer2dOpts,
  Point2,
  ResolvedParallaxLayer2dOpts,
  resolveParallaxLayer2dOpts,
} from '@gg-web-engine/core';
import { Texture, TilingSprite } from 'pixi.js';
import { PixiDisplayObjectComponent } from './pixi-display-object.component';
import { PixiGgWorld, PixiVisualTypeDocRepo2D } from '../types';

/**
 * pixi.js implementation of `IParallaxLayer2dComponent`: a `TilingSprite` living in the scene's
 * world container (so it sorts by `zIndex` against everything else), resized and re-offset by each
 * renderer, right before it draws, to cover that renderer's view. The engine never moves it through
 * `position`; use `offset` instead (meters). The sprite is laid out in pixel space and carries a
 * base scale of one over the scene's `pixelsPerMeter`, so the texture's natural size is its texels
 * over that, multiplied by the options' `scale`.
 */
export class PixiParallaxLayerComponent
  extends PixiDisplayObjectComponent
  implements IParallaxLayer2dComponent<PixiVisualTypeDocRepo2D>
{
  public readonly nativeSprite!: TilingSprite;
  private readonly options: ResolvedParallaxLayer2dOpts<Texture>;

  /** @param pixelsPerMeter - The scene's texel density, see `PixiSceneComponent.pixelsPerMeter`. */
  constructor(
    options: ParallaxLayer2dOpts<Texture>,
    public readonly pixelsPerMeter: number = 100,
  ) {
    const resolved = resolveParallaxLayer2dOpts(options);
    const sprite = new TilingSprite({ texture: resolved.texture });
    sprite.scale.x = sprite.scale.y = 1 / pixelsPerMeter;
    super(sprite);
    this.options = resolved;
    this.nativeSprite.zIndex = resolved.zIndex;
    this.nativeSprite.tileScale.set(resolved.scale.x, resolved.scale.y);
  }

  public get layerOptions(): ResolvedParallaxLayer2dOpts<Texture> {
    return { ...this.options, zIndex: this.zIndex };
  }

  public get parallax(): Point2 {
    return this.options.parallax;
  }

  public set parallax(value: Point2) {
    this.options.parallax = { x: value.x, y: value.y };
  }

  public get offset(): Point2 {
    return this.options.offset;
  }

  public set offset(value: Point2) {
    this.options.offset = { x: value.x, y: value.y };
  }

  /**
   * Places the layer for one view: `center` is the camera position and `halfExtent` half the size
   * of the world-space area the view can show (already accounting for zoom and rotation), both in
   * meters. The tiling itself is computed in the sprite's pixel space, where a tile is the
   * texture's size in texels times the options' `scale`.
   */
  public updateView(center: Point2, halfExtent: Point2): void {
    const { parallax, offset, scale, repeat } = this.options;
    const texture = this.nativeSprite.texture;
    const ppm = this.pixelsPerMeter;
    const axis = (c: number, half: number, p: number, o: number, tileSize: number, repeats: boolean) => {
      // where the texture's origin sits in the world for this camera position
      const origin = o + c * (1 - p);
      if (!repeats) {
        return { start: origin, size: tileSize, tile: 0 };
      }
      const start = c - half;
      const tile = tileSize > 0 ? (((origin - start) % tileSize) + tileSize) % tileSize : 0;
      return { start, size: half * 2, tile };
    };
    const x = axis(
      center.x * ppm,
      halfExtent.x * ppm,
      parallax.x,
      offset.x * ppm,
      texture.width * scale.x,
      repeat === 'x' || repeat === 'both',
    );
    const y = axis(
      center.y * ppm,
      halfExtent.y * ppm,
      parallax.y,
      offset.y * ppm,
      texture.height * scale.y,
      repeat === 'y' || repeat === 'both',
    );
    // the sprite sits in the world container (meters), its content in its own pixel space
    this.nativeSprite.position.set(x.start / ppm, y.start / ppm);
    this.nativeSprite.width = x.size;
    this.nativeSprite.height = y.size;
    this.nativeSprite.tilePosition.set(x.tile, y.tile);
  }

  addToWorld(world: PixiGgWorld): void {
    super.addToWorld(world);
    world.visualScene.parallaxLayers.add(this);
  }

  removeFromWorld(world: PixiGgWorld, dispose?: boolean): void {
    world.visualScene.parallaxLayers.delete(this);
    super.removeFromWorld(world, dispose);
  }

  clone(): PixiParallaxLayerComponent {
    return new PixiParallaxLayerComponent(this.layerOptions, this.pixelsPerMeter);
  }

  dispose(): void {
    // the texture belongs to whoever loaded it and may be shared
    this.nativeSprite.destroy({ texture: false });
  }
}
