// Replaces pixi.js with a minimal TilingSprite stand-in - this package's jest setup can't load the
// real pixi.js runtime (see pixi-display-object.component.spec.ts).
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

const texture = { width: 100, height: 50 } as unknown as Texture;

describe('PixiParallaxLayerComponent', () => {
  it('applies zIndex and tile scale from its options', () => {
    const layer = new PixiParallaxLayerComponent({ texture, zIndex: -3, scale: 2 });
    expect(layer.nativeSprite.zIndex).toBe(-3);
    expect(layer.nativeSprite.tileScale.x).toBe(2);
    expect(layer.layerOptions.zIndex).toBe(-3);
  });

  it('covers the view on a repeating axis and scrolls the tiles at the parallax rate', () => {
    const layer = new PixiParallaxLayerComponent({ texture, parallax: { x: 0.5, y: 0 }, repeat: 'x' });
    layer.updateView({ x: 1000, y: 0 }, { x: 400, y: 300 });
    const sprite = layer.nativeSprite;
    // x repeats: spans the whole view
    expect(sprite.position.x).toBe(600);
    expect(sprite.width).toBe(800);
    // texture origin is at 1000 * (1 - 0.5) = 500 -> (500 - 600) mod 100 = 0
    expect(sprite.tilePosition.x).toBe(0);
    layer.updateView({ x: 1030, y: 0 }, { x: 400, y: 300 });
    // origin 515, start 630 -> (515 - 630) mod 100 = 85
    expect(sprite.tilePosition.x).toBeCloseTo(85);
    // y does not repeat: one texture high at offset + cam.y * (1 - 0) = 0
    expect(sprite.position.y).toBe(0);
    expect(sprite.height).toBe(50);
    expect(sprite.tilePosition.y).toBe(0);
  });

  it('parallax 0 stays fixed on screen, parallax 1 stays fixed in the world', () => {
    const sky = new PixiParallaxLayerComponent({ texture, parallax: 0, repeat: 'none', offset: { x: 10, y: 20 } });
    sky.updateView({ x: 300, y: 300 }, { x: 100, y: 100 });
    expect(sky.nativeSprite.position).toMatchObject({ x: 310, y: 320 });
    const ground = new PixiParallaxLayerComponent({ texture, parallax: 1, repeat: 'none', offset: { x: 10, y: 20 } });
    ground.updateView({ x: 300, y: 300 }, { x: 100, y: 100 });
    expect(ground.nativeSprite.position).toMatchObject({ x: 10, y: 20 });
    expect(ground.nativeSprite.width).toBe(100);
    expect(ground.nativeSprite.height).toBe(50);
  });
});
