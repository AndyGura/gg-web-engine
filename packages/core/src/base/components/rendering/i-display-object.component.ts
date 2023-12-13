import { GgBox, GgWorld, VisualTypeDocRepo } from '../../../base';
import { IWorldComponent } from '../i-world-component';

export interface IDisplayObjectComponent<D, R, TypeDoc extends VisualTypeDocRepo<D, R> = VisualTypeDocRepo<D, R>>
  extends IWorldComponent<D, R, TypeDoc> {
  position: D;
  rotation: R;
  scale: D;

  visible: boolean;

  name: string;

  isEmpty(): boolean;

  popChild(name: string): IDisplayObjectComponent<D, R, TypeDoc> | null;

  getBoundings(): GgBox<D>;

  clone(): IDisplayObjectComponent<D, R, TypeDoc>;

  addToWorld(world: GgWorld<D, R, TypeDoc>): void;

  removeFromWorld(world: GgWorld<D, R, TypeDoc>): void;
}
