import { IBodyComponent } from './i-body.component';
import { PhysicsTypeDocRepo } from '../../gg-world';

export interface IRigidBodyComponent<D, R, PTypeDoc extends PhysicsTypeDocRepo<D, R> = PhysicsTypeDocRepo<D, R>>
  extends IBodyComponent<D, R, PTypeDoc> {
  linearVelocity: D;
  angularVelocity: R | D;

  clone(): IRigidBodyComponent<D, R, PTypeDoc>;

  /** clear velocities etc. */
  resetMotion(): void;
}
