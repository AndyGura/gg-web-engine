import { IVisualSceneComponent, Point3, Point4, RendererOptions } from '../../../base';
import { IDisplayObject3dComponentFactory } from '../../factories';
import { ICameraComponent } from './i-camera.component';
import { IRenderer3dComponent } from './i-renderer-3d.component';
import { IDisplayObject3dComponentLoader } from '../../loaders';

export interface IVisualScene3dComponent extends IVisualSceneComponent<Point3, Point4> {
  readonly factory: IDisplayObject3dComponentFactory;
  readonly loader: IDisplayObject3dComponentLoader;

  createRenderer(
    camera: ICameraComponent,
    canvas?: HTMLCanvasElement,
    rendererOptions?: Partial<RendererOptions>,
  ): IRenderer3dComponent;
}
