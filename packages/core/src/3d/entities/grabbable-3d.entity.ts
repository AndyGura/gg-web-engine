import { CollisionGroup, Pnt3, Point3 } from '../../base';
import { Entity3d } from './entity-3d';
import { Gg3dWorldTypeDocRepo } from '../gg-3d-world';

/**
 * Tuning for a `Grabbable3dEntity`'s hold behavior - how it's driven towards the carrier's hold
 * point while held, and when it gives up rather than fighting geometry it got squeezed into.
 */
export type Grabbable3dEntityOptions = {
  /**
   * How strongly (per second) the held object's velocity is driven towards the target hold
   * point - effectively a spring constant. Higher snaps to the hold point faster/stiffer, lower
   * feels heavier/springier. Default 12.
   */
  followStrength: number;
  /** Hard cap on the linear speed used to chase the hold point, in m/s. Default 20. */
  maxFollowSpeed: number;
  /**
   * How strongly the held object's own angular velocity is damped back towards zero each tick -
   * `0` leaves it entirely alone (spins freely off whatever momentum it had when grabbed), `1`
   * zeroes it outright every tick (rigid, non-spinning while carried, closest to Source's
   * physcannon feel). Default 1.
   */
  angularDamping: number;
  /**
   * If the hold target ever ends up farther than this from the object's actual position (e.g. it
   * got squeezed into a wall/corner it can't be dragged through), it is force-`release()`d instead
   * of being fought back out with an ever-growing spring velocity. In meters. Default 8.
   *
   * Set this comfortably larger than twice whatever `holdDistance` the driving controller uses
   * (e.g. `ObjectGrabController.holdDistance`) - the hold point itself can jump by up to `2 ×
   * holdDistance` from an ordinary, deliberate fast look-around alone (the camera spinning in
   * place, not moving), even with nothing wrong or stuck: a target hold point directly in front of
   * the camera traces a sphere of that radius around the camera position as it turns, so a ~180°
   * flick moves the target by that full diameter in one or two ticks. `maxHoldDistance` set too
   * close to `2 × holdDistance` (e.g. equal to it) force-releases the object on an ordinary fast
   * turn, not just when it's genuinely stuck - reserve this threshold for the latter.
   */
  maxHoldDistance: number;
};

const DEFAULT_OPTIONS: Grabbable3dEntityOptions = {
  followStrength: 12,
  maxFollowSpeed: 20,
  angularDamping: 1,
  maxHoldDistance: 8,
};

/**
 * A dynamic-body prop that can be picked up and carried, HL2/Portal-`+use`-key style - pair with
 * `ObjectGrabController` for the input side (raycasting to find one in reach, binding grab/throw/
 * drop to keys/mouse buttons), or drive it manually by calling `grab()`/`updateHold()`/`release()`/
 * `throw()` yourself.
 *
 * Carrying is implemented as a velocity spring, **not** a position teleport: `updateHold()` sets
 * `objectBody.linearVelocity` towards the target hold point every tick rather than overwriting
 * `position` directly, so the physics engine's own collision resolution still applies while
 * carried (the object gets stopped/deflected by geometry in the way, instead of tunnelling through
 * it and then exploding back out from deep penetration the instant it's released or bumps
 * something - the classic failure mode of teleport-style carrying). This does mean a carried
 * object can visibly lag behind the target hold point when pressed against an obstruction, and can
 * still be knocked around by other dynamic bodies while held (both deliberate - see
 * `ObjectGrabController`'s doc for why that's the desired feel, matching Source's own physgun
 * rather than a rigid attachment).
 *
 * There is deliberately no core-level "disable gravity for this body" primitive backing this
 * class (no physics adapter exposes one) - `updateHold()` instead compensates for gravity
 * algebraically, by subtracting one frame's worth of the world's gravity vector from the velocity
 * it sets. This only approximately cancels out: the physics engine's own `simulate()` call may run
 * several native substeps internally for one `updateHold()` call (this entity only gets to set
 * velocity once per frame, before `simulate()` runs), each re-integrating gravity on top of
 * whatever velocity was set, so a held object can sag very slightly between updates at high
 * substep counts - imperceptible in practice, and no worse an approximation than
 * `CharacterController3dEntity`'s own per-tick gravity integration.
 */
export class Grabbable3dEntity<TypeDoc extends Gg3dWorldTypeDocRepo = Gg3dWorldTypeDocRepo> extends Entity3d<TypeDoc> {
  public readonly grabOptions: Grabbable3dEntityOptions;

  private _isHeld: boolean = false;
  public get isHeld(): boolean {
    return this._isHeld;
  }

  /** `objectBody.interactWithCollisionGroups` as it was just before `grab()`, restored by
   * `release()`/`throw()` - `null` while not held. */
  private _savedInteractWithCollisionGroups: ReadonlyArray<CollisionGroup> | null = null;

  constructor(
    options: {
      object3D?: TypeDoc['vTypeDoc']['displayObject'] | null;
      objectBody?: TypeDoc['pTypeDoc']['rigidBody'] | null;
    },
    grabOptions: Partial<Grabbable3dEntityOptions> = {},
  ) {
    super(options);
    if (!this.objectBody) {
      // this class's whole purpose (a velocity-driven hold spring) is meaningless without a
      // dynamic rigid body to drive - fail loudly here rather than silently no-op-ing every call
      // below for an entity that can never actually be carried.
      throw new Error('Grabbable3dEntity requires a physics body (objectBody) to be grabbable');
    }
    this.grabOptions = { ...DEFAULT_OPTIONS, ...grabOptions };
  }

  /**
   * Starts carrying this object: temporarily removes `ignoreCollisionGroups` from
   * `objectBody.interactWithCollisionGroups` (restored by `release()`/`throw()`), and zeroes the
   * object's current velocity so `updateHold()`'s spring starts clean instead of fighting whatever
   * motion it had the instant before being grabbed. A no-op if already held.
   *
   * `ignoreCollisionGroups` is a generic, low-level knob - whatever groups it names are simply
   * removed from this object's own mask for as long as it's held, for any reason an app might want
   * that. It is **not** how to stop this object from colliding with whoever is holding it: excluding
   * a specific holder this way only works if the object and the holder don't otherwise share a group
   * both need for ordinary world collision, which in practice they almost always do (both usually
   * need to keep colliding with the level's static geometry) - see
   * `ICharacterController3dComponent.ignoredBodies`'s doc for the actual mechanism that handles that
   * case (already wired up automatically by `ObjectGrabController` when constructed with a `holder`).
   * Passing every group the intended holder's own `ownCollisionGroups` happens to report (e.g. a
   * character controller left at its default `ownCollisionGroups: 'all'`, which reports *every*
   * registered group, not just "this character's own") filters all of them out of
   * `interactWithCollisionGroups`, leaving this object colliding with nothing at all - not just the
   * intended target - for as long as it's held.
   */
  grab(ignoreCollisionGroups: ReadonlyArray<CollisionGroup> = []): void {
    if (this._isHeld || !this.objectBody) {
      return;
    }
    this._isHeld = true;
    this._savedInteractWithCollisionGroups = this.objectBody.interactWithCollisionGroups;
    if (ignoreCollisionGroups.length > 0) {
      this.objectBody.interactWithCollisionGroups = this._savedInteractWithCollisionGroups.filter(
        group => !ignoreCollisionGroups.includes(group),
      );
    }
    this.objectBody.linearVelocity = Pnt3.O;
    this.objectBody.angularVelocity = Pnt3.O;
  }

  /**
   * Stops carrying this object, restoring the collision groups `grab()` removed. Leaves whatever
   * velocity `updateHold()` last set on it (a gentle "let go in place") - use `throw()` instead to
   * impart a deliberate outward velocity on release. A no-op if not currently held.
   */
  release(): void {
    if (!this._isHeld) {
      return;
    }
    this._isHeld = false;
    if (this._savedInteractWithCollisionGroups && this.objectBody) {
      this.objectBody.interactWithCollisionGroups = this._savedInteractWithCollisionGroups;
    }
    this._savedInteractWithCollisionGroups = null;
  }

  /**
   * Stops carrying this object (same bookkeeping as `release()`) and immediately imparts
   * `velocity` to it - used for a forward "punt" instead of a gentle drop.
   */
  throw(velocity: Point3): void {
    this.release();
    if (this.objectBody) {
      this.objectBody.linearVelocity = velocity;
    }
  }

  /**
   * Drives the held object towards `targetPosition` this tick via a velocity spring (see this
   * class's own doc for why a velocity, not a position teleport) and damps its angular velocity
   * per `grabOptions.angularDamping`. Force-`release()`s instead if `targetPosition` is currently
   * farther than `grabOptions.maxHoldDistance` from the object - see that option's doc.
   *
   * **Never slows the object down below whatever speed it already has towards `targetPosition`** -
   * only ever raises its speed in that direction up to the spring's own value, never lowers it (the
   * spring's *perpendicular* component is still applied as normal, correcting sideways drift).
   * Mirrors `AmmoCharacterControllerComponent.pushDynamicBody`'s own "only ever adds, never removes"
   * rule: a body already moving *towards* the hold point faster than the spring would carry it - e.g.
   * bumped or shoved there by something else entirely (another dynamic body, not the holder - the
   * holder's own movement never contests a held object's position in the first place, see
   * `ObjectGrabController`'s `ignoredBodies` doc) - is left alone instead of having that speed
   * immediately overwritten with the spring's own, smaller one purely because the object happens to
   * already be close to `targetPosition`. It keeps that speed (redirected exactly at
   * `targetPosition`, not left along whatever direction it was originally pushed in) until it either
   * arrives or drifts past the target, at which point ordinary spring behavior resumes from the other
   * side.
   *
   * Must be called once per tick, **before** `IPhysicsWorld3dComponent.simulate()` runs that same
   * tick - i.e. from a driver with `tickOrder < TickOrder.PHYSICS_SIMULATION` (e.g.
   * `ObjectGrabController`, or your own equivalent) - for the velocity set here to actually be
   * integrated this frame. Deliberately **not** called from this entity's own `tick$`:
   * `Entity3d`'s inherited `tickOrder` (`OBJECTS_BINDING`) runs *after* physics simulation, to sync
   * the mesh from the just-simulated body - the opposite direction from what the hold spring
   * needs - so this class does not add a second, earlier `tick$` subscription of its own. A no-op
   * if not currently held, or if this entity hasn't been spawned into a world with a physics
   * world yet.
   */
  updateHold(targetPosition: Point3, dt: number): void {
    if (!this._isHeld || !this.objectBody) {
      return;
    }
    const toTarget = Pnt3.sub(targetPosition, this.objectBody.position);
    if (Pnt3.len(toTarget) > this.grabOptions.maxHoldDistance) {
      this.release();
      return;
    }
    let desiredVelocity = Pnt3.scalarMult(toTarget, this.grabOptions.followStrength);
    let speed = Pnt3.len(desiredVelocity);
    if (speed > this.grabOptions.maxFollowSpeed) {
      desiredVelocity = Pnt3.scalarMult(desiredVelocity, this.grabOptions.maxFollowSpeed / speed);
      speed = this.grabOptions.maxFollowSpeed;
    }
    if (speed > 1e-6) {
      // See this method's own doc for why: don't let the spring undo a push/bump that's already
      // carrying the object towards the target faster than the spring itself would.
      const towardsTarget = Pnt3.scalarMult(desiredVelocity, 1 / speed);
      const currentSpeedTowardsTarget = Pnt3.dot(this.objectBody.linearVelocity, towardsTarget);
      if (currentSpeedTowardsTarget > speed) {
        desiredVelocity = Pnt3.scalarMult(towardsTarget, currentSpeedTowardsTarget);
      }
    }
    const gravity = this.world?.physicsWorld?.gravity ?? Pnt3.O;
    // Counter this frame's worth of gravity integration up front - see class doc on why this is
    // only an approximation, not an exact cancellation.
    this.objectBody.linearVelocity = Pnt3.sub(desiredVelocity, Pnt3.scalarMult(gravity, dt));
    if (this.grabOptions.angularDamping > 0) {
      this.objectBody.angularVelocity = Pnt3.scalarMult(
        this.objectBody.angularVelocity,
        1 - Math.min(1, this.grabOptions.angularDamping),
      );
    }
  }

  onRemoved(): void {
    // Being torn down (e.g. level unload) while still held - release first, so nothing holding a
    // reference to this entity as its "heldObject" (e.g. `ObjectGrabController`) is left pointing
    // at a since-removed entity with stale collision-group bookkeeping.
    if (this._isHeld) {
      this.release();
    }
    super.onRemoved();
  }
}
