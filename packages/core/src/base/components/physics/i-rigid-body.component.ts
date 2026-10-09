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

  /**
   * Accumulates a force, in Newtons, to act on this body during the next `simulate()` call - for
   * every substep that call runs - and nothing after it: a force that should act continuously
   * (air drag, wind, a thruster) is re-applied every tick, so a tick-driven caller can reason in
   * forces and let the adapter integrate (`v += F / m * dt`) at whatever step the native engine
   * runs, instead of rewriting `linearVelocity` itself every tick. Several calls in one tick add up.
   *
   * Given a `worldPoint` (world coordinates), the force acts there rather than at the centre of
   * mass, so an off-centre force also turns the body (a wheel pushing one corner, a side wind on a
   * sail); without it, the body is pushed without any turning. Wakes a sleeping body. A static or
   * kinematic body ignores it, as does a body not currently in a world.
   */
  applyForce(force: D, worldPoint?: D): void;

  /**
   * Instantly changes this body's velocity by `impulse / mass` (`impulse` in N·s): an explosion, a
   * kick, a hit - a one-off push that does not depend on the length of any tick. Given a
   * `worldPoint` (world coordinates), the impulse also spins the body, like `applyForce` with a
   * point. Wakes a sleeping body; a static/kinematic body, or one not in a world, ignores it.
   */
  applyImpulse(impulse: D, worldPoint?: D): void;

  /**
   * Accumulates a torque (N·m, same type as `angularVelocity`: a `Point3` axis-scaled vector in 3D,
   * a signed scalar in 2D) to act on this body during the next `simulate()` call only - the
   * rotational counterpart of `applyForce`, with the same per-tick lifetime and the same rules for
   * sleeping, static/kinematic and not-yet-added bodies.
   */
  applyTorque(torque: R | D): void;

  /**
   * Instantly changes this body's angular velocity by `torqueImpulse / inertia` (N·m·s, same type
   * as `angularVelocity`) - the rotational counterpart of `applyImpulse`, with the same rules.
   */
  applyTorqueImpulse(torqueImpulse: R | D): void;

  clone(): IRigidBodyComponent<D, R, PTypeDoc>;

  /** clear velocities etc. */
  resetMotion(): void;

  /**
   * Whether this body is currently asleep - a native engine's own performance optimization that
   * deactivates a dynamic body once it's been at rest for a while, skipping it entirely from the
   * next `simulate()` step until something (a write to this body, or a collision) wakes it back up.
   * A static body always reports `false` here - sleeping is only ever a dynamic-body concept.
   */
  get isSleeping(): boolean;

  /**
   * Forces this body awake. A no-op on a static body.
   *
   * Every adapter's existing `position`/`rotation`/`linearVelocity`/`angularVelocity` setters
   * already wake a sleeping dynamic body on write - **except `packages/matter`'s**, whose setters
   * preserve whatever sleep state the body was already in. Calling `wakeUp()` explicitly is only
   * needed when you want a body awake without also writing one of those four (e.g. to keep it
   * simulating this step for some other reason).
   */
  wakeUp(): void;

  /**
   * Forces this body to sleep immediately, without waiting for it to naturally come to rest. A
   * no-op on a static body.
   *
   * Every adapter's existing `position`/`rotation`/`linearVelocity`/`angularVelocity` setters wake
   * a sleeping dynamic body back up on write, except `packages/matter`'s, which preserve sleep
   * state across such a write. So a caller that must write one of those four on a body without
   * waking it - on any adapter, `packages/matter`'s included - should call `sleep()` again right
   * after the write, to force it back to sleep regardless of whether that particular adapter's
   * setter would have woken it or not.
   */
  sleep(): void;

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
