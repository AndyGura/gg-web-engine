import { Gg3dObject } from './gg-3d-object';

export interface Gg3dObjectFactory {
  createBox(width: number, length: number, height: number): Gg3dObject;
  createSphere(radius: number): Gg3dObject;
}
