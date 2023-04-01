import { IGg3dBody, IGg3dCamera } from '../interfaces';
import { Gg3dEntity } from './gg-3d-entity';

export class Gg3dCameraEntity<T extends IGg3dCamera = IGg3dCamera> extends Gg3dEntity {
  public get fov(): number {
    return this.object3D.fov;
  }
  public set fov(value: number) {
    this.object3D.fov = value;
  }
  constructor(public readonly object3D: T, public readonly objectBody: IGg3dBody | null = null) {
    super(object3D, objectBody);
  }
}
