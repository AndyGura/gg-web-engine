import { GgBox, GgWorld, GgWorldTypeDocVPatch, VisualTypeDocRepo } from '../../../base';
import { IWorldComponent } from '../i-world-component';

export interface IDisplayObjectComponent<
  D,
  R,
  VTypeDoc extends VisualTypeDocRepo<D, R> = VisualTypeDocRepo<D, R>,
> extends IWorldComponent<D, R, GgWorldTypeDocVPatch<D, R, VTypeDoc>> {
  position: D;
  rotation: R;
  scale: D;

  visible: boolean;

  name: string;

  isEmpty(): boolean;

  popChild(name: string): IDisplayObjectComponent<D, R, VTypeDoc> | null;

  /**
   * Nests `child` inside this display object: from now on the child's `position`/`rotation`/`scale`
   * are relative to this object, so it follows every move, turn and rescale of this object (and is
   * hidden together with it). `child` must come from the same visual adapter and must not be added
   * to a world on its own - it is rendered as part of this object instead. A child that already has
   * another parent is moved here. Children are carried along by `clone()` and disposed together
   * with this object.
   */
  addChild(child: IDisplayObjectComponent<D, R, VTypeDoc>): void;

  /**
   * Undoes `addChild`: detaches `child` from this object, without disposing it. A no-op if `child`
   * isn't a direct child of this object.
   */
  removeChild(child: IDisplayObjectComponent<D, R, VTypeDoc>): void;

  getBoundings(): GgBox<D>;

  clone(): IDisplayObjectComponent<D, R, VTypeDoc>;

  addToWorld(world: GgWorld<D, R, GgWorldTypeDocVPatch<D, R, VTypeDoc>>): void;

  removeFromWorld(world: GgWorld<D, R, GgWorldTypeDocVPatch<D, R, VTypeDoc>>, dispose?: boolean): void;
}
