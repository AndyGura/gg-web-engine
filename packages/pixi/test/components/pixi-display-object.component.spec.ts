// Replaces pixi.js with minimal stand-ins - this package's jest setup can't currently load the real
// pixi.js runtime (its own ESM dependency chain, e.g. `earcut`, fails under ts-jest/CommonJS here).
jest.mock('pixi.js', () => {
  class Point {
    x = 0;
    y = 0;
    copyFrom(p: { x: number; y: number }) {
      this.x = p.x;
      this.y = p.y;
    }
  }
  class Container {
    position = new Point();
    scale = Object.assign(new Point(), { x: 1, y: 1 });
    pivot = new Point();
    skew = new Point();
    rotation = 0;
    visible = true;
    zIndex = 0;
    tint = 0xffffff;
    alpha = 1;
    children: Container[] = [];
    parent: Container | null = null;
    destroyed = false;
    addChild(child: Container) {
      this.children.push(child);
      child.parent = this;
    }
    destroy() {
      this.destroyed = true;
      this.children.forEach(c => c.destroy());
    }
  }
  class Graphics extends Container {
    context = {};
    clone(deep?: boolean) {
      const clone = new Graphics();
      clone.context = deep ? { ...this.context } : this.context;
      return clone;
    }
  }
  class Sprite extends Container {
    anchor = new Point();
    constructor(public texture: unknown) {
      super();
    }
  }
  class AnimatedSprite extends Sprite {
    animationSpeed = 1;
    loop = true;
    constructor(
      public textures: unknown[],
      public autoUpdate: boolean,
    ) {
      super(textures[0]);
    }
  }
  class Text extends Container {
    anchor = new Point();
    text: string;
    style: any;
    constructor(options: { text: string; style?: any }) {
      super();
      this.text = options.text;
      this.style = options.style;
    }
  }
  return { Container, Graphics, Sprite, AnimatedSprite, Text };
});

import { AnimatedSprite, Container, Graphics, Sprite } from 'pixi.js';
import { PixiDisplayObjectComponent } from '../../src/components/pixi-display-object.component';
import { PixiAnimatedSpriteComponent } from '../../src/components/pixi-animated-sprite.component';

// A minimal stand-in for a real pixi.js `Container` (`Graphics`/`Sprite`/...) - avoids importing
// the real pixi.js runtime, which this package's jest setup can't currently load (its own ESM
// dependency chain, e.g. `earcut`, fails under ts-jest/CommonJS here).
const fakeContainer = () => ({}) as unknown as Container;

describe('PixiDisplayObjectComponent', () => {
  describe('materialOptions (IMaterialReadable2dComponent)', () => {
    it('exposes the options it was constructed with', () => {
      const component = new PixiDisplayObjectComponent(fakeContainer(), { color: 0x990000 });

      expect(component.materialOptions).toEqual({ color: 0x990000 });
    });

    it('leaves materialOptions unset when constructed without any (e.g. an animated sprite)', () => {
      const component = new PixiDisplayObjectComponent(fakeContainer());

      expect(component.materialOptions).toBeUndefined();
      expect('materialOptions' in component).toBe(false);
    });
  });

  describe('tint and opacity', () => {
    it('map to the native tint and alpha', () => {
      const native = { tint: 0xffffff, alpha: 1 } as unknown as Container;
      const component = new PixiDisplayObjectComponent(native);

      component.tint = 0x336699;
      component.opacity = 0.25;

      expect(native.tint).toBe(0x336699);
      expect(native.alpha).toBe(0.25);
      expect(component.tint).toBe(0x336699);
      expect(component.opacity).toBe(0.25);
    });
  });

  describe('addChild/removeChild', () => {
    // just enough of a Container's child bookkeeping to observe what the component does
    const fakeParentContainer = () => {
      const container: any = {
        children: [] as any[],
        addChild(child: any) {
          child.parent?.removeChild(child);
          container.children.push(child);
          child.parent = container;
        },
        removeChild(child: any) {
          container.children = container.children.filter((c: any) => c !== child);
          child.parent = null;
        },
      };
      return container as Container;
    };

    it('nests the child native container in the parent one and detaches it again', () => {
      const parent = new PixiDisplayObjectComponent(fakeParentContainer());
      const child = new PixiDisplayObjectComponent(fakeParentContainer());

      parent.addChild(child);
      expect(parent.nativeSprite.children).toEqual([child.nativeSprite]);
      expect(child.nativeSprite.parent).toBe(parent.nativeSprite);

      parent.removeChild(child);
      expect(parent.nativeSprite.children).toEqual([]);
      expect(child.nativeSprite.parent).toBeNull();
    });

    it('ignores removeChild for an object that is not its child', () => {
      const parent = new PixiDisplayObjectComponent(fakeParentContainer());
      const other = new PixiDisplayObjectComponent(fakeParentContainer());
      const stranger = new PixiDisplayObjectComponent(fakeParentContainer());
      other.addChild(stranger);

      parent.removeChild(stranger);
      expect(stranger.nativeSprite.parent).toBe(other.nativeSprite);
    });
  });

  describe('clone', () => {
    it('copies the native object, its state and its children into independent ones', () => {
      const texture = {};
      const native = new Sprite(texture as any);
      native.anchor.x = native.anchor.y = 0.5;
      const parent = new PixiDisplayObjectComponent(native, { color: 0x990000 });
      parent.position = { x: 3, y: 4 };
      parent.rotation = 0.5;
      parent.scale = { x: 2, y: 2 };
      parent.tint = 0x336699;
      parent.opacity = 0.25;
      parent.zIndex = 7;
      const child = new PixiDisplayObjectComponent(new Graphics());
      child.position = { x: 1, y: 0 };
      parent.addChild(child);

      const clone = parent.clone();

      expect(clone.nativeSprite).not.toBe(native);
      expect(clone.nativeSprite).toBeInstanceOf(Sprite);
      expect((clone.nativeSprite as Sprite).texture).toBe(texture);
      expect((clone.nativeSprite as Sprite).anchor.x).toBe(0.5);
      expect(clone.materialOptions).toEqual({ color: 0x990000 });
      expect(clone.position).toEqual({ x: 3, y: 4 });
      expect(clone.rotation).toBe(0.5);
      expect(clone.scale).toEqual({ x: 2, y: 2 });
      expect(clone.tint).toBe(0x336699);
      expect(clone.opacity).toBe(0.25);
      expect(clone.zIndex).toBe(7);

      expect(clone.nativeSprite.children.length).toBe(1);
      const clonedChild = clone.nativeSprite.children[0] as Graphics;
      expect(clonedChild).toBeInstanceOf(Graphics);
      expect(clonedChild).not.toBe(child.nativeSprite);
      expect(clonedChild.context).not.toBe((child.nativeSprite as Graphics).context);
      expect(clonedChild.position.x).toBe(1);
    });

    it('disposing a clone leaves the original and its children intact, and vice versa', () => {
      const parent = new PixiDisplayObjectComponent(new Container());
      const child = new PixiDisplayObjectComponent(new Graphics());
      parent.addChild(child);
      const clone = parent.clone();
      const secondClone = parent.clone();

      clone.dispose();
      expect(parent.nativeSprite.destroyed).toBe(false);
      expect(child.nativeSprite.destroyed).toBe(false);

      parent.dispose();
      expect(child.nativeSprite.destroyed).toBe(true);
      expect(secondClone.nativeSprite.destroyed).toBe(false);
      expect(secondClone.nativeSprite.children[0].destroyed).toBe(false);
    });

    it('clones an animated sprite with its children, tint and opacity', () => {
      const frames = [{}, {}] as any;
      const sprite = new PixiAnimatedSpriteComponent(new AnimatedSprite(frames, false), { idle: { frames } });
      sprite.tint = 0xff0000;
      sprite.opacity = 0.5;
      sprite.addChild(new PixiDisplayObjectComponent(new Graphics()));

      const clone = sprite.clone();

      expect(clone).toBeInstanceOf(PixiAnimatedSpriteComponent);
      expect(clone.nativeSprite).not.toBe(sprite.nativeSprite);
      expect(clone.nativeSprite).toBeInstanceOf(AnimatedSprite);
      expect(clone.animationNames).toEqual(['idle']);
      expect(clone.tint).toBe(0xff0000);
      expect(clone.opacity).toBe(0.5);
      expect(clone.nativeSprite.children.length).toBe(1);
    });
  });
});
