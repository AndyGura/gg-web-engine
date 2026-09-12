import { IAudioSceneComponent, Point3, Point4 } from '../../../base';
import { AudioTypeDocRepo3D } from '../../gg-3d-world';

export interface IAudioScene3dComponent<
  ATypeDoc extends AudioTypeDocRepo3D = AudioTypeDocRepo3D,
> extends IAudioSceneComponent<Point3, Point4, ATypeDoc> {}
