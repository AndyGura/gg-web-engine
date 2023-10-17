import { GgBox, GgWorld, IVisualSceneComponent } from '../../../base';
import { IWorldComponent } from '../i-world-component';

export interface IDisplayObjectComponent<D, R, VS extends IVisualSceneComponent<D, R> = IVisualSceneComponent<D, R>>
  extends IWorldComponent<D, R, VS> {
  position: D;
  rotation: R;
  scale: D;

  visible: boolean;

  name: string;

  isEmpty(): boolean;

  popChild(name: string): IDisplayObjectComponent<D, R, VS> | null;

  getBoundings(): GgBox<D>;

  clone(): IDisplayObjectComponent<D, R, VS>;

  addToWorld(world: GgWorld<D, R, VS>): void;

  removeFromWorld(world: GgWorld<D, R, VS>): void;
}
