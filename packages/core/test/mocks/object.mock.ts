import { IGg3dObject, Pnt3 } from '../../src';


export const mock3DObject = (): IGg3dObject => {
  return {
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
    scale: { x: 1, y: 1, z: 1 },
    name: '',
    visible: true,
    clone: () => mock3DObject(),
    getBoundings: () => ({ min: Pnt3.O, max: { x: 10, y: 10, z: 10 }}),
  } as IGg3dObject;
};
