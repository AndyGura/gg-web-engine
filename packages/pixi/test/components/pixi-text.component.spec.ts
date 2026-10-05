// Replaces pixi.js with a minimal Text stand-in - this package's jest setup can't load the real
// pixi.js runtime (see pixi-display-object.component.spec.ts).
jest.mock('pixi.js', () => {
  class Point {
    x = 0;
    y = 0;
    set(x: number, y: number) {
      this.x = x;
      this.y = y;
    }
    copyFrom(p: { x: number; y: number }) {
      this.set(p.x, p.y);
    }
  }
  class Container {
    position = new Point();
    scale = new Point();
    pivot = new Point();
    skew = new Point();
    rotation = 0;
    visible = true;
    zIndex = 0;
    tint = 0xffffff;
    alpha = 1;
    children: Container[] = [];
    addChild(child: Container) {
      this.children.push(child);
    }
  }
  class Text extends Container {
    text: string;
    style: any = {};
    anchor = new Point();
    constructor(options: { text: string }) {
      super();
      this.text = options.text;
    }
  }
  class Graphics extends Container {
    clone() {
      return new Graphics();
    }
  }
  class Sprite extends Container {}
  class AnimatedSprite extends Sprite {}
  return { Container, Text, Graphics, Sprite, AnimatedSprite };
});

import { Graphics } from 'pixi.js';
import { PixiDisplayObjectComponent } from '../../src/components/pixi-display-object.component';
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

  it('clones into an independent text component with the same string, style, state and children', () => {
    const text = new PixiTextComponent('hello', { fontSize: 20, anchor: { x: 0.5, y: 1 } });
    text.position = { x: 3, y: 4 };
    text.opacity = 0.5;
    text.addChild(new PixiDisplayObjectComponent(new Graphics()));

    const clone = text.clone();

    expect(clone).toBeInstanceOf(PixiTextComponent);
    expect(clone.nativeSprite).not.toBe(text.nativeSprite);
    expect(clone.text).toBe('hello');
    expect(clone.style).toEqual({ fontSize: 20, anchor: { x: 0.5, y: 1 } });
    expect(clone.nativeSprite.anchor.x).toBe(0.5);
    expect(clone.position).toEqual({ x: 3, y: 4 });
    expect(clone.opacity).toBe(0.5);
    expect(clone.nativeSprite.children.length).toBe(1);

    clone.text = 'bye';
    expect(text.text).toBe('hello');
  });
});
