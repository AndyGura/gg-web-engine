import { IEntity } from '../../entities/i-entity';
import { IPhysicsWorldComponent } from './i-physics-world.component';
import { IWorldComponent } from '../i-world-component';
import { GgWorld } from '../../gg-world';
import { IVisualSceneComponent } from '../rendering/i-visual-scene.component';

export interface IBodyComponent<D, R, PW extends IPhysicsWorldComponent<D, R> = IPhysicsWorldComponent<D, R>>
  extends IWorldComponent<D, R, IVisualSceneComponent<D, R>, PW> {
  entity: IEntity | null;

  position: D;
  rotation: R;

  name: string;

  clone(): IBodyComponent<D, R, PW>;

  addToWorld(world: GgWorld<D, R, IVisualSceneComponent<D, R>, PW>): void;

  removeFromWorld(world: GgWorld<D, R, IVisualSceneComponent<D, R>, PW>): void;
}
