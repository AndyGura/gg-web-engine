import { IAnimatedDisplayObject3dComponent, IDisplayObject2dComponent, IDisplayObject3dComponent, Pnt2, Pnt3 } from '../../src';

export const mock2DObject = (): IDisplayObject2dComponent => {
  return {
    position: { x: 0, y: 0 },
    rotation: 0,
    scale: { x: 1, y: 1 },
    name: '',
    visible: true,
    addToWorld() {},
    removeFromWorld() {},
    clone: () => mock2DObject(),
    getBoundings: () => ({ min: Pnt2.O, max: { x: 10, y: 10 } }),
  } as unknown as IDisplayObject2dComponent;
};

export const mock3DObject = (): IDisplayObject3dComponent => {
  // Mirrors a fresh three.js `Object3D`'s own native default render-layer state (`MAIN_RENDER_LAYER`
  // alone) - see `IDisplayObject3dComponent.enableRenderLayer`'s own doc.
  const renderLayers = new Set<number>([0]);
  return {
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
    scale: { x: 1, y: 1, z: 1 },
    name: '',
    visible: true,
    addToWorld() {},
    removeFromWorld() {},
    clone: () => mock3DObject(),
    getBoundings: () => ({ min: Pnt3.O, max: { x: 10, y: 10, z: 10 } }),
    enableRenderLayer: (layer: number) => {
      renderLayers.add(layer);
    },
    disableRenderLayer: (layer: number) => {
      renderLayers.delete(layer);
    },
    isRenderLayerEnabled: (layer: number) => renderLayers.has(layer),
  } as unknown as IDisplayObject3dComponent;
};

/**
 * A `mock3DObject()` extended with `IAnimatedDisplayObject3dComponent`'s methods - `playAnimation`
 * calls are recorded verbatim in `playCalls` (in order, oldest first) for assertions, on top of
 * tracking `currentAnimationName` the same way a real adapter would.
 */
export const mockAnimatedObject = (
  animationNames: string[],
): IAnimatedDisplayObject3dComponent & { playCalls: { name: string; options?: Record<string, unknown> }[] } => {
  const base = mock3DObject();
  // Plain mutable field, not a getter - object-spread/`Object.assign` semantics snapshot a
  // getter's *current return value* into a plain value property at spread time (this mirrors real
  // `Object.assign` behavior, not a test-only quirk), so a `get currentAnimationName()` defined
  // alongside `...base` below would never actually update after construction.
  const result = {
    ...base,
    animationNames,
    currentAnimationName: null as string | null,
    playAnimation(name: string, options?: Record<string, unknown>) {
      result.playCalls.push({ name, options });
      result.currentAnimationName = name;
    },
    stopAnimation() {
      result.currentAnimationName = null;
    },
    updateAnimations() {},
    playCalls: [] as { name: string; options?: Record<string, unknown> }[],
  };
  return result as unknown as IAnimatedDisplayObject3dComponent & {
    playCalls: { name: string; options?: Record<string, unknown> }[];
  };
};
