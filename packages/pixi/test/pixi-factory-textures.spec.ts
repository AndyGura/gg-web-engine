// Replaces pixi.js with stand-ins for what the texture methods touch - this package's jest setup
// can't load the real pixi.js runtime (see components/pixi-display-object.component.spec.ts).
jest.mock('pixi.js', () => {
  class ImageSource {
    scaleMode = 'linear';
    constructor(public options: any) {}
  }
  class Texture {
    source: any;
    destroy = jest.fn();
    constructor(options: { source: any }) {
      this.source = options.source;
    }
  }
  class Stub {}
  return {
    ImageSource,
    Texture,
    Assets: { load: jest.fn() },
    AnimatedSprite: Stub,
    Container: Stub,
    Graphics: Stub,
    Rectangle: Stub,
    Sprite: Stub,
    TilingSprite: Stub,
    Text: Stub,
  };
});

import { Assets } from 'pixi.js';
import { PixiFactory } from '../src/pixi-factory';

describe('PixiFactory textures from fetched data', () => {
  const originalCreateImageBitmap = (global as any).createImageBitmap;

  beforeEach(() => {
    (global as any).createImageBitmap = jest.fn(async (blob: Blob) => ({ bitmapOf: blob }));
  });

  afterEach(() => {
    (global as any).createImageBitmap = originalCreateImageBitmap;
  });

  it('textureFromData decodes the blob itself, outside the global Assets cache, and applies options', async () => {
    const blob = new Blob(['x']);
    const texture: any = await new PixiFactory().textureFromData(blob, { filter: 'nearest' });
    expect((global as any).createImageBitmap).toHaveBeenCalledWith(blob);
    expect(texture.source.options.resource).toEqual({ bitmapOf: blob });
    expect(texture.source.scaleMode).toBe('nearest');
    expect(Assets.load).not.toHaveBeenCalled();
  });

  it('disposeTexture destroys the texture together with its source', async () => {
    const factory = new PixiFactory();
    const texture: any = await factory.textureFromData(new Blob(['x']));
    factory.disposeTexture(texture);
    expect(texture.destroy).toHaveBeenCalledWith(true);
  });

  it('prepare uploads the source on every initialized renderer of the scene, and is a no-op without one', async () => {
    const ready = { nativeTextureSystem: { initSource: jest.fn() } };
    const notReady = { nativeTextureSystem: null };
    const scene: any = { renderers: new Set([ready, notReady]) };
    const texture: any = await new PixiFactory(scene).textureFromData(new Blob(['x']));

    await new PixiFactory(scene).prepare(texture);
    expect(ready.nativeTextureSystem.initSource).toHaveBeenCalledWith(texture.source);

    await expect(new PixiFactory().prepare(texture)).resolves.toBeUndefined();
  });
});
