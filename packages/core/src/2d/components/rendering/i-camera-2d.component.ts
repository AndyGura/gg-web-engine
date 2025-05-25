import { IDisplayObject2dComponent } from './i-display-object-2d.component';
import { VisualTypeDocRepo2D } from '../../gg-2d-world';

export interface ICamera2dComponent<VTypeDoc extends VisualTypeDocRepo2D = VisualTypeDocRepo2D>
  extends IDisplayObject2dComponent<VTypeDoc> {
  zoom: number;
}
