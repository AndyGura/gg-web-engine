import { Gg3dBody } from './gg-3d-body';

export interface Gg3dBodyFactory {
  createBox(width: number, length: number, height: number, mass: number): Gg3dBody;
  createSphere(radius: number, mass: number): Gg3dBody;
}
