import { IVisualSceneComponent, Point2 } from '../../../base';
import { VisualTypeDocRepo2D } from '../../gg-2d-world';
import { Environment2dOpts } from '../../models/environment';

export interface IVisualScene2dComponent<
  VTypeDoc extends VisualTypeDocRepo2D = VisualTypeDocRepo2D,
> extends IVisualSceneComponent<Point2, number, VTypeDoc> {
  /** The scene's current environment. A fresh scene's `background` is `null`, so the renderer's
   * own clear color shows. */
  readonly environment: Readonly<Environment2dOpts<VTypeDoc['texture']>>;

  /** Changes the scene's environment. Only the fields present change; `null` clears a field. */
  setEnvironment(environment: Partial<Environment2dOpts<VTypeDoc['texture']>>): void;
}
