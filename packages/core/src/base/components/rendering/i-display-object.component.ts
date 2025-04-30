import { GgBox, GgWorld, GgWorldTypeDocVPatch, VisualTypeDocRepo } from '../../../base';
import { IWorldComponent } from '../i-world-component';

export interface IDisplayObjectComponent<D, R, VTypeDoc extends VisualTypeDocRepo<D, R> = VisualTypeDocRepo<D, R>>
  extends IWorldComponent<D, R, GgWorldTypeDocVPatch<D, R, VTypeDoc>> {
  position: D;
  rotation: R;
  scale: D;

  visible: boolean;

  name: string;

  isEmpty(): boolean;

  popChild(name: string): IDisplayObjectComponent<D, R, VTypeDoc> | null;

  getBoundings(): GgBox<D>;

  clone(): IDisplayObjectComponent<D, R, VTypeDoc>;

  addToWorld(world: GgWorld<D, R, GgWorldTypeDocVPatch<D, R, VTypeDoc>>): void;

  removeFromWorld(world: GgWorld<D, R, GgWorldTypeDocVPatch<D, R, VTypeDoc>>): void;
}
