import { IDisplayObject2dComponent, IDisplayObject3dComponent, Pnt2, Pnt3 } from '../../src';


export const mock2DObject = (): IDisplayObject2dComponent => {
  return {
    position: { x: 0, y: 0 },
    rotation: 0,
    scale: { x: 1, y: 1 },
    name: '',
    visible: true,
    clone: () => mock2DObject(),
    getBoundings: () => ({ min: Pnt2.O, max: { x: 10, y: 10 } }),
  } as IDisplayObject2dComponent;
};


export const mock3DObject = (): IDisplayObject3dComponent => {
  return {
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
    scale: { x: 1, y: 1, z: 1 },
    name: '',
    visible: true,
    clone: () => mock3DObject(),
    getBoundings: () => ({ min: Pnt3.O, max: { x: 10, y: 10, z: 10 } }),
  } as IDisplayObject3dComponent;
};
