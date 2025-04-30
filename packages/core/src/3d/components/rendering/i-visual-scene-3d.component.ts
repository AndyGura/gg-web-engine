import { IVisualSceneComponent, Point3, Point4, RendererOptions } from '../../../base';
import { VisualTypeDocRepo3D } from '../../gg-3d-world';

export interface IVisualScene3dComponent<VTypeDoc extends VisualTypeDocRepo3D = VisualTypeDocRepo3D>
  extends IVisualSceneComponent<Point3, Point4, VTypeDoc> {
  readonly loader: VTypeDoc['loader'];

  createRenderer(
    camera: VTypeDoc['camera'],
    canvas?: HTMLCanvasElement,
    rendererOptions?: Partial<RendererOptions & VTypeDoc['rendererExtraOpts']>,
  ): VTypeDoc['renderer'];
}
