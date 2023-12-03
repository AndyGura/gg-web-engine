import { IPhysicsWorldComponent } from './i-physics-world.component';
import { IBodyComponent } from './i-body.component';

export interface IRigidBodyComponent<D, R, PW extends IPhysicsWorldComponent<D, R> = IPhysicsWorldComponent<D, R>>
  extends IBodyComponent<D, R, PW> {
  linearVelocity: D;
  angularVelocity: R | D;

  clone(): IRigidBodyComponent<D, R, PW>;

  /** clear velocities etc. */
  resetMotion(): void;
}
