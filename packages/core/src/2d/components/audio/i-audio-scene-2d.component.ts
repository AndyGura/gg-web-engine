import { IAudioSceneComponent, Point2 } from '../../../base';
import { AudioTypeDocRepo2D } from '../../gg-2d-world';

export interface IAudioScene2dComponent<
  ATypeDoc extends AudioTypeDocRepo2D = AudioTypeDocRepo2D,
> extends IAudioSceneComponent<Point2, number, ATypeDoc> {}
