import { IGg3dBody } from './i-gg-3d-body';

export interface IGg3dBodyFactory {
  createBox(width: number, length: number, height: number, mass: number): IGg3dBody;
  createSphere(radius: number, mass: number): IGg3dBody;
}
