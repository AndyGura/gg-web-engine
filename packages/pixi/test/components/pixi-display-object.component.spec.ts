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
});
