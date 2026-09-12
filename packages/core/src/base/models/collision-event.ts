/**
 * Payload emitted by `IRigidBodyComponent.onCollisionStart` when this body begins touching
 * another rigid body via a real, physical contact - not a trigger/sensor overlap (see
 * `ITriggerComponent.onEntityEntered` for that; a trigger has no collision response and never
 * fires this). Carries enough of the contact to react differently to a light tap versus a hard
 * crash without re-deriving it from raw physics state - e.g. picking a different impact sound, or
 * only reacting above some damage threshold.
 *
 * `RigidBody` is left as its own type parameter (rather than derived from a `PhysicsTypeDocRepo`
 * directly) so this type can be used both at the dimension-agnostic base interface (where it's the
 * abstract `IRigidBodyComponent<D, R, PTypeDoc>`) and re-declared at the 2D/3D-concrete interface
 * level narrowed to `PTypeDoc['rigidBody']` - mirroring how `ITriggerComponent.onEntityEntered` is
 * narrowed the same way, without this type recursively expanding through its own default type
 * parameter in the process (which trips TS's structural check on the enclosing `Observable`).
 */
export interface CollisionEvent<D, RigidBody = unknown> {
  /** the other body this one just started touching */
  otherBody: RigidBody;

  /** world-space point of contact */
  position: D;

  /** contact normal at `position`, pointing away from this body towards `otherBody` */
  normal: D;

  /**
   * velocity of `otherBody` relative to this body, at the moment contact began (i.e. the
   * pre-response approach vector) - its magnitude and direction together describe how hard, and
   * from which angle, the hit landed.
   */
  relativeVelocity: D;

  /**
   * Approximate magnitude of the collision impulse (kg·m/s). Meaningful for comparing hits
   * against each other within the *same* physics adapter (e.g. thresholding "light" vs "hard"
   * hit sound effects) - the exact figure is derived differently per physics engine (a solved
   * contact impulse on some backends, a contact-force-times-timestep estimate on others), so
   * don't assume the same numeric value means the same thing across two different adapters.
   */
  impulse: number;
}
