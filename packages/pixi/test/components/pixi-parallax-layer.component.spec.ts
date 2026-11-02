// Replaces pixi.js with a minimal TilingSprite stand-in, so the test sees exactly what the layer
// writes to it (the real runtime does load under jest, see test/contract).
jest.mock('pixi.js', () => {
  const point = () => ({
    x: 0,
    y: 0,
    set(x: number, y: number) {
      this.x = x;
      this.y = y;
    },
  });
  class TilingSprite {
    texture: any;
    position = point();
    tilePosition = point();
    tileScale = point();
    scale = { x: 1, y: 1 };
    width = 0;
    height = 0;
    zIndex = 0;
    constructor(options: { texture: any }) {
      this.texture = options.texture;
    }
  }
  return { TilingSprite };
});

import type { Texture } from 'pixi.js';
import { PixiParallaxLayerComponent } from '../../src/components/pixi-parallax-layer.component';

// a 100x50 px texture: 1x0.5 m at 100 px/m
const texture = { width: 100, height: 50 } as unknown as Texture;
const ppm = 100;

describe('PixiParallaxLayerComponent', () => {
  it('applies zIndex and tile scale from its options, and a base scale of one over pixelsPerMeter', () => {
    const layer = new PixiParallaxLayerComponent({ texture, zIndex: -3, scale: 2 }, ppm);
    expect(layer.nativeSprite.zIndex).toBe(-3);
    expect(layer.nativeSprite.tileScale.x).toBe(2);
    expect(layer.layerOptions.zIndex).toBe(-3);
    expect(layer.nativeSprite.scale).toEqual({ x: 0.01, y: 0.01 });
    expect(layer.scale).toEqual({ x: 1, y: 1 });
  });

  it('covers the view on a repeating axis and scrolls the tiles at the parallax rate', () => {
    const layer = new PixiParallaxLayerComponent({ texture, parallax: { x: 0.5, y: 0 }, repeat: 'x' }, ppm);
    // camera 10 m along x, the view 8x6 m
    layer.updateView({ x: 10, y: 0 }, { x: 4, y: 3 });
    const sprite = layer.nativeSprite;
    // x repeats: spans the whole view, positioned in meters, sized in its own pixel space
    expect(sprite.position.x).toBeCloseTo(6);
    expect(sprite.width).toBeCloseTo(800);
    // texture origin is at 10 * (1 - 0.5) = 5 m = 500 px -> (500 - 600) mod 100 = 0
    expect(sprite.tilePosition.x).toBeCloseTo(0);
    layer.updateView({ x: 10.3, y: 0 }, { x: 4, y: 3 });
    // origin 515 px, start 630 px -> (515 - 630) mod 100 = 85
    expect(sprite.tilePosition.x).toBeCloseTo(85);
    // y does not repeat: one texture high at offset + cam.y * (1 - 0) = 0
    expect(sprite.position.y).toBe(0);
    expect(sprite.height).toBe(50);
    expect(sprite.tilePosition.y).toBe(0);
  });

  it('parallax 0 stays fixed on screen, parallax 1 stays fixed in the world; offset is meters', () => {
    const sky = new PixiParallaxLayerComponent(
      { texture, parallax: 0, repeat: 'none', offset: { x: 0.1, y: 0.2 } },
      ppm,
    );
    sky.updateView({ x: 3, y: 3 }, { x: 1, y: 1 });
    expect(sky.nativeSprite.position.x).toBeCloseTo(3.1);
    expect(sky.nativeSprite.position.y).toBeCloseTo(3.2);
    const ground = new PixiParallaxLayerComponent(
      { texture, parallax: 1, repeat: 'none', offset: { x: 0.1, y: 0.2 } },
      ppm,
    );
    ground.updateView({ x: 3, y: 3 }, { x: 1, y: 1 });
    expect(ground.nativeSprite.position.x).toBeCloseTo(0.1);
    expect(ground.nativeSprite.position.y).toBeCloseTo(0.2);
    // one tile: the texture's texels, scaled down to 1x0.5 m by the base scale
    expect(ground.nativeSprite.width).toBe(100);
    expect(ground.nativeSprite.height).toBe(50);
  });

  it('a texture is its texels over pixelsPerMeter in meters: the same tiles are 10x wider at 10 px/m', () => {
    const layer = new PixiParallaxLayerComponent({ texture, parallax: 1, repeat: 'x' }, 10);
    expect(layer.nativeSprite.scale).toEqual({ x: 0.1, y: 0.1 });
    layer.updateView({ x: 0, y: 0 }, { x: 50, y: 50 });
    // the view is 100 m = 1000 px wide at 10 px/m, ten 100 px tiles
    expect(layer.nativeSprite.width).toBeCloseTo(1000);
    expect(layer.nativeSprite.position.x).toBeCloseTo(-50);
  });
});
