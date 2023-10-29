import { IEntity } from '../entities/i-entity';
import { GgWorld } from '../gg-world';
import { IVisualSceneComponent } from './rendering/i-visual-scene.component';
import { IPhysicsWorldComponent } from './physics/i-physics-world.component';

export interface IWorldComponent<
  D,
  R,
  V extends IVisualSceneComponent<D, R> = IVisualSceneComponent<D, R>,
  P extends IPhysicsWorldComponent<D, R> = IPhysicsWorldComponent<D, R>,
> {
  entity: IEntity | null;
  addToWorld(world: GgWorld<D, R, V, P>): void;
  removeFromWorld(world: GgWorld<D, R, V, P>, dispose?: boolean): void;
  dispose(): void;
}
