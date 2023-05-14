import { IGg3dObject } from '../../src';


export const mock3DObject = () => {
  return {
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
    scale: { x: 1, y: 1, z: 1 },
    name: '',
  } as IGg3dObject;
};
