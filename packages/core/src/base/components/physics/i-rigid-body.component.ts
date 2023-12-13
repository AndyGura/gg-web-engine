import { IBodyComponent } from './i-body.component';
import { PhysicsTypeDocRepo } from '../../gg-world';

export interface IRigidBodyComponent<D, R, TypeDoc extends PhysicsTypeDocRepo<D, R> = PhysicsTypeDocRepo<D, R>>
  extends IBodyComponent<D, R, TypeDoc> {
  linearVelocity: D;
  angularVelocity: R | D;

  clone(): IRigidBodyComponent<D, R, TypeDoc>;

  /** clear velocities etc. */
  resetMotion(): void;
}
