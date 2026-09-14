import { IDisplayObject2dComponent, IDisplayObject3dComponent, Pnt2, Pnt3 } from '../../src';

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
