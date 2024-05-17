import { IVisualSceneComponent, Point3, Point4, RendererOptions } from '../../../base';
import { VisualTypeDocRepo3D } from '../../gg-3d-world';

export interface IVisualScene3dComponent<TypeDoc extends VisualTypeDocRepo3D = VisualTypeDocRepo3D>
  extends IVisualSceneComponent<Point3, Point4, TypeDoc> {
  readonly loader: TypeDoc['loader'];

  createRenderer(
    camera: TypeDoc['camera'],
    canvas?: HTMLCanvasElement,
    rendererOptions?: Partial<RendererOptions & TypeDoc['rendererExtraOpts']>,
  ): TypeDoc['renderer'];
}
