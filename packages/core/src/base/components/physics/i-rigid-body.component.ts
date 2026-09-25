import { Observable } from 'rxjs';
import { IBodyComponent } from './i-body.component';
import { PhysicsTypeDocRepo } from '../../gg-world';
import { CollisionEvent } from '../../models/collision-event';
import { BodyOptions } from '../../models/body-options';

export interface IRigidBodyComponent<
  D,
  R,
  PTypeDoc extends PhysicsTypeDocRepo<D, R> = PhysicsTypeDocRepo<D, R>,
> extends IBodyComponent<D, R, PTypeDoc> {
  linearVelocity: D;
  angularVelocity: R | D;

  /**
   * The `BodyOptions` this body currently has - the read-back counterpart of the `body` field
   * `IPhysicsBody(2d|3d)ComponentFactory.createRigidBody` takes. `bodyType`/`mass`/`restitution`/
   * `friction`/`ccd` are exactly what this body was constructed with: this engine's public API has
   * no way to mutate any of them after creation (no setter exists for any of the five, on this
   * interface or any adapter's own component), so a value read here stays accurate for the body's
   * entire lifetime, not just at construction time. `ownCollisionGroups`/`interactWithCollisionGroups`
   * are the same genuinely-live values `IBodyComponent`'s own getters of the same name already
   * expose (both have setters, and can change after construction) - included here too so this
   * getter alone is a complete, ready-to-reuse `BodyOptions` (e.g. `factory.createRigidBody({shape,
   * body: existingBody.bodyOptions}, existingBody.position, existingBody.rotation)` reproduces an
   * equivalent body).
   *
   * Lets a rigid body's construction settings be recovered from the live body alone, regardless of
   * how - or by what code - it was actually built (unlike an app-level record of what was originally
   * requested, which only exists for a body built through whatever code bothered to keep one).
   */
  get bodyOptions(): Readonly<BodyOptions>;

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
