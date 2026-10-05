import type { Container } from 'pixi.js';
import { PixiDisplayObjectComponent } from '../../src/components/pixi-display-object.component';

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
});
