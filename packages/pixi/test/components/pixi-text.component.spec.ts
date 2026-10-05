// Replaces pixi.js with a minimal Text stand-in - this package's jest setup can't load the real
// pixi.js runtime (see pixi-display-object.component.spec.ts).
jest.mock('pixi.js', () => {
  class Text {
    text: string;
    style: any = {};
    anchor = {
      x: 0,
      y: 0,
      set(x: number, y: number) {
        this.x = x;
        this.y = y;
      },
    };
    constructor(options: { text: string }) {
      this.text = options.text;
    }
  }
  return { Text };
});

import { PixiTextComponent } from '../../src/components/pixi-text.component';

describe('PixiTextComponent', () => {
  it('creates a native text with the given string and style', () => {
    const text = new PixiTextComponent('hello', {
      fontFamily: 'monospace',
      fontSize: 13,
      fontWeight: 'bold',
      color: 0xffffff,
      stroke: { color: 0x000000, width: 4 },
      anchor: { x: 0.5, y: 1 },
    });

    expect(text.text).toBe('hello');
    expect(text.nativeSprite.style).toEqual({
      fontFamily: 'monospace',
      fontSize: 13,
      fontWeight: 'bold',
      fill: 0xffffff,
      stroke: { color: 0x000000, width: 4 },
    });
    expect(text.nativeSprite.anchor.x).toBe(0.5);
    expect(text.nativeSprite.anchor.y).toBe(1);
  });

  it('setStyle changes only the given fields', () => {
    const text = new PixiTextComponent('', { fontSize: 20, color: 0xffffff });

    text.setStyle({ color: 0xff0000 });

    expect(text.style).toEqual({ fontSize: 20, color: 0xff0000 });
    expect(text.nativeSprite.style).toEqual({ fontSize: 20, fill: 0xff0000 });
  });

  it('updates the displayed string', () => {
    const text = new PixiTextComponent('a');
    text.text = 'b';
    expect(text.nativeSprite.text).toBe('b');
  });
});
