import { IGg3dObject } from './i-gg-3d-object';

export interface IGg3dObjectFactory {
  createBox(width: number, length: number, height: number): IGg3dObject;
  createSphere(radius: number): IGg3dObject;
}
