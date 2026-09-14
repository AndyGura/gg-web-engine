import { Observable } from 'rxjs';
import { IBodyComponent } from './i-body.component';
import { PhysicsTypeDocRepo } from '../../gg-world';
import { CollisionEvent } from '../../models/collision-event';

export interface IRigidBodyComponent<
  D,
  R,
  PTypeDoc extends PhysicsTypeDocRepo<D, R> = PhysicsTypeDocRepo<D, R>,
> extends IBodyComponent<D, R, PTypeDoc> {
  linearVelocity: D;
  angularVelocity: R | D;

  clone(): IRigidBodyComponent<D, R, PTypeDoc>;

  /** clear velocities etc. */
  resetMotion(): void;

  /**
   * Fires each time this body begins touching another rigid body it wasn't already touching -
   * the "hit"/crash counterpart of `ITriggerComponent.onEntityEntered`, but for a real collision
   * response rather than a sensor overlap.
   */
  get onCollisionStart(): Observable<CollisionEvent<D, IRigidBodyComponent<D, R, PTypeDoc>>>;

  /**
   * Fires each time this body stops touching a rigid body it was previously touching. `null`
   * when the other body was removed from the world while still in contact (mirrors
   * `ITriggerComponent.onEntityLeft`'s same convention) - no further contact geometry is
   * available at separation, only which body it was.
   */
  get onCollisionEnd(): Observable<IRigidBodyComponent<D, R, PTypeDoc> | null>;
}
