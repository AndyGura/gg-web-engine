import {
  CharacterController3dOptions,
  DebugBody3DSettings,
  ICharacterController3dComponent,
  IEntity,
  Pnt3,
  Point3,
  Point4,
  Qtrn,
} from '@gg-web-engine/core';
import Ammo from '../ammo.js/ammo';
import { AmmoBodyComponent } from './ammo-body.component';
import { AmmoRigidBodyComponent } from './ammo-rigid-body.component';
import { AmmoWorldComponent } from './ammo-world.component';
import { AmmoGgWorld, AmmoPhysicsTypeDocRepo } from '../types';

// `ownCollisionGroups` defaults to the physics world's main group (like any other body) - resolved
// per-instance in the constructor (it needs the live `world.mainCollisionGroup`, not a static
// default), so it's intentionally left out of this shared literal, unlike the rest of the options.
const DEFAULT_OPTIONS: Required<
  Omit<CharacterController3dOptions, 'radius' | 'centersDistance' | 'ownCollisionGroups'>
> = {
  offset: 0.01,
  maxStepHeight: 0.3,
  minStepWidth: 0.2,
  maxSlopeClimbAngleRad: (50 * Math.PI) / 180,
  snapToGroundDistance: 0.3,
  up: Pnt3.Z,
  interactWithCollisionGroups: 'all',
  pushMass: 80,
};

// `Ammo.wrapPointer(ptr, Class)` turns a raw numeric handle - what embind actually hands a
// `ConcreteContactResultCallback::addSingleResult` override, despite the ambient types describing
// typed object parameters - back into a usable wrapped instance of `Class`. Present at runtime in
// this package's pinned Ammo.js build (verified empirically), just not declared in
// `ammo-ambient.d.ts`.
type AmmoWithWrapPointer = typeof Ammo & {
  wrapPointer<T>(ptr: number, type: { new (...args: never[]): T }): T;
};

/** btCollisionObject::CF_CHARACTER_OBJECT - not exposed as a numeric constant by the Ammo.js
 * embind bindings (only as an opaque preprocessor-define string type), so it's inlined here as the
 * literal Bullet uses internally, same as `AmmoTriggerComponent`/`AmmoFactory` do for
 * `CF_NO_CONTACT_RESPONSE` (4) elsewhere in this package. */
const CF_CHARACTER_OBJECT = 16;

/** btCollisionObject::CF_NO_CONTACT_RESPONSE - see `CF_CHARACTER_OBJECT`'s doc above for why this
 * is inlined rather than read off the Ammo.js embind bindings. Combined with `CF_CHARACTER_OBJECT`
 * on this character's ghost object (see the constructor) so Bullet's own discrete dynamics world
 * never generates its own collision response for it.
 *
 * **Why this is needed**: without it, `btDiscreteDynamicsWorld`'s constraint solver still
 * processes every manifold `performDiscreteCollisionDetection` finds between this ghost object and
 * a dynamic rigid body during `stepSimulation` - even though the ghost is never added via
 * `addRigidBody` and thus never itself gets integrated by the solver. `btRigidBody::upcast()` on a
 * non-rigid-body collision object returns null, so the solver falls back to treating that side of
 * the manifold as a fixed/immovable body for contact-resolution purposes. The resulting correction
 * lands entirely on the dynamic body, but - since it's driven by the manifold's penetration depth
 * and Bullet's own (Baumgarte/split-impulse) recovery-speed cap, not by any real momentum transfer
 * from the "immovable" side - it comes out at roughly the same magnitude regardless of that body's
 * own mass, and carries no friction/tangential component (so it never spins a body it pushes).
 * Confirmed empirically: with `CF_NO_CONTACT_RESPONSE` NOT set, a light and a heavy dynamic box
 * both got shoved at effectively the same ~0.8 m/s by an identical walk-into, even with this
 * class's own `pushDynamicBody` (see below) entirely disabled (`pushMass: 0`) - i.e. this native
 * response, not `pushDynamicBody`, was the actual (mass-blind, non-rotating) source of "pushing"
 * before this flag was added. Setting it makes the ghost a pure sensor as far as Bullet's own
 * dynamics are concerned (matching what `move()`'s hand-rolled `convexSweepTest`-based mover
 * already assumed - see this class's own doc), leaving `pushDynamicBody` as the sole source of any
 * push a dynamic body feels, so it can actually be mass-aware. */
const CF_NO_CONTACT_RESPONSE = 4;

type SweepResult = {
  hasHit: boolean;
  /** 0..1 fraction of the requested delta that was actually clear to move through. */
  fraction: number;
  hitNormal?: Point3;
  /** `Ammo.getPointer()` of the hit collision object, if any - used to push a dynamic body hit
   * during horizontal movement (see `pushDynamicBody`). */
  hitObjectPtr?: number;
};

/**
 * A capsule-shaped kinematic character controller implemented as a direct sweep-and-slide mover
 * against Bullet's collision world (`btCollisionWorld.convexSweepTest`), rather than via Bullet's
 * own `btKinematicCharacterController`.
 *
 * **Why not `btKinematicCharacterController`**: it was the first approach tried here, but its
 * `setWalkDirection`/`preStep`/`playerStep` sequence - driven directly (never via `world.addAction`/
 * `stepSimulation`, to keep `move()` synchronous per this interface's contract) - never produced any
 * collision response at all in this package's pinned Ammo.js WASM build, for either horizontal or
 * vertical displacement (verified empirically: a capsule dropped straight through a static floor
 * and a wall alike, with `onGround()` reporting stale/incorrect state throughout). A parallel direct
 * `btCollisionWorld.convexSweepTest` call against the exact same shape/world/transforms, by
 * contrast, correctly detected both - confirming the collision world/broadphase/shape setup is
 * fine, and the bug is specific to `btKinematicCharacterController`'s own internal sweep in this
 * build (root cause not fully identified; plausibly a stale/never-populated
 * `btGhostObject`/overlapping-pairs cache that its internals depend on, since that cache stayed at
 * 0 pairs throughout, or a build-specific miscompilation of that class - `convexSweepTest` itself
 * needs no such cache, doing a fresh broadphase query per call). Building movement directly on
 * `convexSweepTest` sidesteps the class entirely and is fully understood/controlled by this file.
 * A `btPairCachingGhostObject` is still used as the character's collision-object identity (added to
 * the collision world so other queries/debug views can see it, and so `AmmoBodyComponent`'s
 * position/rotation get/set work off its transform like any other body) - it just isn't driven by
 * `btKinematicCharacterController` any more.
 *
 * Divergences from the interface's own options, documented here since Ammo/Bullet has no direct
 * equivalent for them:
 * - `minStepWidth` is not honored - this mover's step-up assist always attempts a step (up to
 *   `maxStepHeight`) with no separate "is there enough room on top" width check.
 * - `groundNormal` is the sweep-hit normal when grounded via the main vertical sweep, or `up` when
 *   grounded via the extra ground-snap ray; `null` while airborne.
 */
export class AmmoCharacterControllerComponent
  extends AmmoBodyComponent<Ammo.btPairCachingGhostObject>
  implements ICharacterController3dComponent<AmmoPhysicsTypeDocRepo>
{
  public entity: IEntity | null = null;

  public readonly radius: number;
  public readonly centersDistance: number;

  private readonly resolvedOptions: Required<Omit<CharacterController3dOptions, 'radius' | 'centersDistance'>>;
  private readonly nativeShape: Ammo.btCapsuleShapeZ;

  private _up: Point3;
  private _isGrounded: boolean = false;
  private _groundNormal: Point3 | null = null;

  // Module-wide (not per-instance) so a scene with several characters all being driven without
  // `dt` still only logs once, not once per character per tick - see `move()`'s missing-`dt`
  // handling below.
  private static warnedMissingDtForPush = false;

  public get up(): Point3 {
    return this._up;
  }

  public set up(value: Point3) {
    this._up = Pnt3.norm(value);
  }

  public get isGrounded(): boolean {
    return this._isGrounded;
  }

  public get groundNormal(): Point3 | null {
    return this._groundNormal;
  }

  readonly debugBodySettings: DebugBody3DSettings = new DebugBody3DSettings(
    // A kinematic character never truly "sleeps" the way a dynamic rigid body does - it's either
    // being actively driven every tick or idle at rest; report it as always-awake.
    { type: 'RIGID_DYNAMIC', sleeping: () => false },
    this.shape,
  );

  constructor(
    world: AmmoWorldComponent,
    options: CharacterController3dOptions,
    transform?: { position?: Point3; rotation?: Point4 },
  ) {
    const resolved: Required<Omit<CharacterController3dOptions, 'radius' | 'centersDistance'>> = {
      ...DEFAULT_OPTIONS,
      ownCollisionGroups: [world.mainCollisionGroup],
      ...options,
    };

    const nativeShape = new Ammo.btCapsuleShapeZ(options.radius, options.centersDistance);
    nativeShape.setMargin(resolved.offset);

    const ghostObject = new Ammo.btPairCachingGhostObject();
    ghostObject.setCollisionShape(nativeShape);
    ghostObject.setCollisionFlags(CF_CHARACTER_OBJECT | CF_NO_CONTACT_RESPONSE);
    const pos = transform?.position || Pnt3.O;
    const rot = transform?.rotation || Qtrn.O;
    const initialTransform = ghostObject.getWorldTransform();
    initialTransform.setOrigin(new Ammo.btVector3(pos.x, pos.y, pos.z));
    initialTransform.setRotation(new Ammo.btQuaternion(rot.x, rot.y, rot.z, rot.w));
    ghostObject.setWorldTransform(initialTransform);

    super(world, ghostObject, { shape: 'CAPSULE', radius: options.radius, centersDistance: options.centersDistance });

    this.radius = options.radius;
    this.centersDistance = options.centersDistance;
    this.resolvedOptions = resolved;
    this.nativeShape = nativeShape;
    this._up = Pnt3.norm(resolved.up);

    // Base class defaults both own/interact masks to `[world.mainCollisionGroup]`; this interface's
    // own default for `interactWithCollisionGroups` is `'all'`, so always (re-)apply both here.
    this.ownCollisionGroups = resolved.ownCollisionGroups;
    this.interactWithCollisionGroups = resolved.interactWithCollisionGroups;
  }

  /**
   * Moves the character by exactly `desiredTranslation`, resolved fully synchronously via a
   * sequence of `convexSweepTest` calls against the current collision world - see this class's doc
   * for why `btKinematicCharacterController` isn't used. Splits the desired displacement into a
   * horizontal part (swept with a single step-up assist and a single slide-along-the-surface bounce)
   * and a vertical part (swept straight, used to detect the ground), then falls back to a short
   * extra downward ray (mirroring `snapToGroundDistance`) when the vertical sweep alone didn't find
   * ground this tick (e.g. standing still, or walking off a slope with no explicit vertical input).
   */
  move(desiredTranslation: Point3, dt?: number): void {
    const collisionWorld = this.world.dynamicAmmoWorld;
    if (!collisionWorld) {
      // not part of an initialized world (or not yet added) - nothing to sweep against
      return;
    }

    const up = this._up;
    const skin = this.resolvedOptions.offset;
    const vertical = Pnt3.scalarMult(up, Pnt3.dot(desiredTranslation, up));
    const horizontal = Pnt3.sub(desiredTranslation, vertical);

    // must run before any sweep this tick - see `recoverFromPenetration`'s doc for why a sweep
    // starting from an already-(even slightly)-penetrating pose is silently unreliable
    let pos = this.recoverFromPenetration(this.position);

    if (Pnt3.len(horizontal) > 1e-9) {
      pos = this.moveHorizontalWithStepAndSlide(pos, horizontal, up, skin, dt);
    }

    // Moving strictly upward (a jump/rising through the air) must never be pulled back down by the
    // ground-snap fallback below - it exists to hug the ground while falling/standing still, not to
    // cancel out a deliberate upward move. Bug found empirically: without this guard, every jump
    // was immediately undone the very next tick, since `desiredTranslation`'s small per-tick rise
    // is well within `snapToGroundDistance` of the floor the character just left.
    const movingUp = Pnt3.dot(vertical, up) > 1e-9;

    let grounded = false;
    let groundNormal: Point3 | null = null;
    if (Pnt3.len(vertical) > 1e-9) {
      const verticalDir = Pnt3.norm(vertical);
      const movingDown = Pnt3.dot(vertical, up) < 0;
      const result = this.sweep(pos, Pnt3.add(pos, vertical), skin);
      const travelled = Pnt3.len(vertical) * result.fraction;
      pos = Pnt3.add(pos, Pnt3.scalarMult(verticalDir, travelled));

      if (result.hasHit && movingDown && result.hitNormal && this.isWalkableNormal(result.hitNormal, up)) {
        grounded = true;
        groundNormal = result.hitNormal;
      } else if (result.hasHit) {
        // Blocked by something that isn't walkable ground underfoot - most commonly a ceiling while
        // ascending (jumping), or a too-steep slope pressed straight into. Back off by a comfortable
        // margin (not just the sweep's own `allowedCcdPenetration`/`skin`) so the landing position
        // never ends up embedded - see `backOffFromObstacle`'s doc. Deliberately *not* applied to
        // the ordinary floor-landing branch above (kept at its established, tightly-tested
        // embedded-by-`skin` precision): floor embedding was never the source of the bug this guards
        // against, and that branch's resting height is relied on elsewhere.
        pos = this.backOffFromObstacle(pos, verticalDir, travelled, this.contactClearance);

        if (result.fraction < 0.999 && result.hitNormal) {
          // slide the remaining distance along the hit surface's tangent instead of just stopping
          // dead pressed against it, so the entity's own gravity integration (which keeps
          // accelerating here since this never reports `grounded`, see
          // `CharacterController3dEntity.isWalkableGround`) actually carries the character down a
          // too-steep slope over subsequent ticks rather than leaving it stuck jittering in place.
          const remaining = Pnt3.scalarMult(vertical, 1 - result.fraction);
          const n = result.hitNormal;
          const slideVec = Pnt3.sub(remaining, Pnt3.scalarMult(n, Pnt3.dot(remaining, n)));
          if (Pnt3.len(slideVec) > 1e-9) {
            const slideDir = Pnt3.norm(slideVec);
            const slideResult = this.sweep(pos, Pnt3.add(pos, slideVec), skin);
            const slideTravelled = Pnt3.len(slideVec) * slideResult.fraction;
            pos = Pnt3.add(pos, Pnt3.scalarMult(slideDir, slideTravelled));
            if (slideResult.hasHit) {
              pos = this.backOffFromObstacle(pos, slideDir, slideTravelled, this.contactClearance);
            }
          }
        }
      }
    }

    if (!grounded && !movingUp && this.resolvedOptions.snapToGroundDistance > 0) {
      const snapped = this.trySnapToGround(pos, up, skin);
      if (snapped) {
        pos = snapped.position;
        grounded = true;
        groundNormal = snapped.normal;
      }
    }

    this.position = pos;
    this._isGrounded = grounded;
    this._groundNormal = groundNormal;
  }

  private isWalkableNormal(normal: Point3, up: Point3): boolean {
    return Pnt3.angle(normal, up) <= this.resolvedOptions.maxSlopeClimbAngleRad;
  }

  /**
   * A comfortable real-world clearance to leave between the capsule and whatever a sweep/ray just
   * stopped it against - shared by `trySnapToGround`'s ray-start margin and `backOffFromObstacle`.
   * Deliberately larger than `resolvedOptions.offset`/`skin` itself (`convexSweepTest`'s
   * `allowedCcdPenetration`, which is how much penetration the *sweep* tolerates, not how much real
   * gap anything downstream can rely on): `CharacterController3dEntity.tryStandUp`'s headroom
   * raycast (core, shared across every backend) starts its own ray `max(offset * 2, 0.02)` above the
   * character's current top, so leaving only `skin`-sized clearance here (as small as `offset`
   * itself) isn't always enough to keep that ray's start point outside the obstacle too - see
   * `backOffFromObstacle`'s doc for the concrete failure this caused.
   */
  private get contactClearance(): number {
    return Math.max(this.resolvedOptions.offset * 4, 0.02);
  }

  /**
   * `convexSweepTest`'s `allowedCcdPenetration` (passed as `skin` to every `sweep()` call in this
   * class) lets a blocked sweep's returned `fraction` land the capsule up to that amount *inside*
   * whatever it hit, by design (see `sweep()`'s own doc). Most callers of `position` never notice
   * this - a resting height a hair lower than geometrically exact is invisible - but
   * `CharacterController3dEntity.tryStandUp`'s headroom raycast (core, shared across every backend)
   * starts its ray only a hair above the character's *current* top, trusting that point to be
   * outside every body but the character's own. A landing position left embedded in a ceiling after
   * a blocked *upward* sweep breaks that assumption: the "hair above" point ends up inside the
   * ceiling too, so the ray never registers an entry hit against it and the headroom check wrongly
   * reports "clear" - regression, found jumping while crouched under a ceiling too low to stand
   * under: the character reset to standing height and visibly clipped into it. Backing the landing
   * position off by `contactClearance` (comfortably more than the sweep's own `allowedCcdPenetration`
   * itself, not just enough to cancel it out) right here, at the source, keeps every consumer of
   * `position` (not just that one call site) from ever seeing an embedded result, rather than
   * patching each caller individually.
   */
  private backOffFromObstacle(pos: Point3, dir: Point3, travelled: number, amount: number): Point3 {
    if (travelled <= 0) {
      return pos;
    }
    return Pnt3.sub(pos, Pnt3.scalarMult(dir, Math.min(travelled, amount)));
  }

  /**
   * Sweeps the horizontal delta; if blocked, attempts a single "step up by maxStepHeight, retry
   * horizontally, settle back down" pass (for small ledges/stairs), otherwise slides once along the
   * remaining blocked distance, projected onto the obstacle's surface plane.
   */
  private moveHorizontalWithStepAndSlide(
    start: Point3,
    horizontal: Point3,
    up: Point3,
    skin: number,
    dt: number | undefined,
  ): Point3 {
    let pos = start;
    let result = this.sweep(pos, Pnt3.add(pos, horizontal), skin);
    const blocked = result.hasHit && result.fraction < 0.999;

    // Push whatever this first, unobstructed-path sweep found - deliberately based on the full
    // attempted `horizontal` delta (converted to a speed via `dt` - see `pushDynamicBody`'s doc),
    // not scaled by `result.fraction`, since how hard the character pushes depends on how fast it's
    // trying to move, not on how much of that motion the obstacle actually let through. Runs
    // regardless of whether a step-up assist below ends up clearing this same obstacle - the
    // character still bumped into it this tick either way.
    //
    // `dt` is required to recover a real m/s speed from `horizontal` (see
    // `ICharacterController3dComponent.move()`'s doc: it exists specifically so a mover that pushes
    // dynamic bodies can do this). `CharacterController3dEntity` always passes it, but the interface
    // itself leaves it optional for callers that don't need pushing. Falling back to the raw
    // per-tick displacement as if it were already a speed used to understate push force by roughly a
    // factor of `dt` (a 16ms tick's displacement is ~60x smaller than the equivalent m/s figure) -
    // silently wrong, not just imprecise. Since this component *does* implement pushing, it isn't
    // free to ignore `dt` the way a non-pushing mover is; skip the push outright when it's missing
    // rather than guess, with a one-time warning so a caller relying on pushMass without dt finds out
    // instead of silently getting near-zero push force.
    if (result.hasHit && result.hitObjectPtr !== undefined) {
      if (dt && dt > 1e-9) {
        const speed = Pnt3.len(horizontal) / dt;
        this.pushDynamicBody(result.hitObjectPtr, Pnt3.norm(horizontal), speed);
      } else if (this.resolvedOptions.pushMass > 0 && !AmmoCharacterControllerComponent.warnedMissingDtForPush) {
        AmmoCharacterControllerComponent.warnedMissingDtForPush = true;
        console.warn(
          '[AmmoCharacterControllerComponent] move() was called without `dt` while `pushMass` > 0 - ' +
            'skipping this dynamic-body push rather than approximating character speed from raw ' +
            'per-tick displacement (which would understate push force by roughly 1/dt). Pass the ' +
            'real tick delta (seconds) as the third argument to move() to enable pushing dynamic bodies.',
        );
      }
    }

    let raised = 0;
    if (blocked && this.resolvedOptions.maxStepHeight > 0) {
      const maxStep = this.resolvedOptions.maxStepHeight;
      const upSweep = this.sweep(pos, Pnt3.add(pos, Pnt3.scalarMult(up, maxStep)), skin);
      const raisedAmount = maxStep * upSweep.fraction;
      const raisedPos = Pnt3.add(pos, Pnt3.scalarMult(up, raisedAmount));
      const retry = this.sweep(raisedPos, Pnt3.add(raisedPos, horizontal), skin);
      const wouldClearMore = retry.fraction > result.fraction + 1e-6;
      // Only accept the step if it *both* clears more horizontal distance at the raised height
      // *and* actually settles back onto a walkable surface there - otherwise this is a curved or
      // vertical obstacle (e.g. a cylinder) giving a spuriously larger sweep fraction a hair higher
      // up with nothing to actually stand on, not a real stair/ledge. Without this check the mover
      // would accept the "step" anyway and repeat it every tick while pressed against such an
      // obstacle, incrementally "climbing" its smooth side (regression, found by walking around a
      // vertical cylinder).
      const steppedPos = wouldClearMore ? Pnt3.add(raisedPos, Pnt3.scalarMult(horizontal, retry.fraction)) : null;
      const landing =
        steppedPos && this.sweep(steppedPos, Pnt3.sub(steppedPos, Pnt3.scalarMult(up, raisedAmount + skin)), skin);
      const lands = !!landing?.hasHit && !!landing.hitNormal && this.isWalkableNormal(landing.hitNormal, up);
      if (steppedPos && lands) {
        raised = raisedAmount;
        pos = steppedPos;
        result = retry;
      } else {
        pos = Pnt3.add(pos, Pnt3.scalarMult(horizontal, result.fraction));
      }
    } else {
      pos = Pnt3.add(pos, Pnt3.scalarMult(horizontal, result.fraction));
    }

    if (result.hasHit && result.fraction < 0.999 && result.hitNormal) {
      const remaining = Pnt3.scalarMult(horizontal, 1 - result.fraction);
      const n = result.hitNormal;
      const slideVec = Pnt3.sub(remaining, Pnt3.scalarMult(n, Pnt3.dot(remaining, n)));
      if (Pnt3.len(slideVec) > 1e-9) {
        const slideResult = this.sweep(pos, Pnt3.add(pos, slideVec), skin);
        pos = Pnt3.add(pos, Pnt3.scalarMult(slideVec, slideResult.fraction));
      }
    }

    if (raised > 1e-6) {
      const downResult = this.sweep(pos, Pnt3.sub(pos, Pnt3.scalarMult(up, raised)), skin);
      pos = Pnt3.sub(pos, Pnt3.scalarMult(up, raised * downResult.fraction));
    }

    return pos;
  }

  /**
   * One extra downward ray beyond the main vertical sweep above - lets a still/near-ground
   * character (zero or near-zero vertical input this tick) register as grounded, and approximates
   * `snapToGroundDistance` for following a slope/staircase down without briefly going airborne each
   * step. The ray starts a hair below the capsule's actual bottom point (past its own outward
   * surface) so it can never register a hit against the character's own shape.
   */
  private trySnapToGround(pos: Point3, up: Point3, skin: number): { position: Point3; normal: Point3 } | null {
    const halfHeight = this.radius + this.centersDistance / 2;
    const bottom = Pnt3.sub(pos, Pnt3.scalarMult(up, halfHeight));
    // `convexSweepTest`'s `allowedPenetration` (this component's `skin`/`offset`) lets a swept
    // capsule come to rest already slightly *inside* a surface by up to that amount - a resting
    // character's actual bottom point can therefore be a hair below the floor's true surface. A ray
    // starting there (or only `skin` above it) would begin already inside the floor and never
    // register an entry hit, so start comfortably above that worst case instead - see
    // `contactClearance`'s own doc for why this reuses that same margin rather than a local one.
    const from = Pnt3.add(bottom, Pnt3.scalarMult(up, this.contactClearance));
    const to = Pnt3.sub(bottom, Pnt3.scalarMult(up, this.resolvedOptions.snapToGroundDistance));

    const result = this.world.raycast({
      from,
      to,
      collisionFilterGroups: [...this.ownCollisionGroups],
      collisionFilterMask: [...this.interactWithCollisionGroups],
    });
    if (!result.hasHit || !result.hitPoint || !result.hitNormal || !this.isWalkableNormal(result.hitNormal, up)) {
      return null;
    }

    const newBottom = Pnt3.add(result.hitPoint, Pnt3.scalarMult(up, skin));
    return { position: Pnt3.add(newBottom, Pnt3.scalarMult(up, halfHeight)), normal: result.hitNormal };
  }

  /**
   * Pushes the character out of any body it currently overlaps, iterating a few times since
   * resolving one contact can reveal/deepen another. Must run before any sweep this tick.
   *
   * **Why this is needed**: `convexSweepTest` (used throughout this class - see this method's
   * sibling `sweep()`) is a conservative-advancement cast that can only compute a time-of-impact
   * when it *starts* outside the target - a well-documented Bullet/GJK limitation. Once this
   * character's shape ends up even slightly embedded in another body, every subsequent
   * `convexSweepTest` against that body silently reports no hit at all, from any position, in any
   * direction - not a jitter or a one-tick glitch, a permanent blind spot to that specific body -
   * so the character walks straight through it, undetected, forever after. This is exactly how a
   * character could walk clean through a low overhead beam: approaching it slowed the character
   * down correctly (a legitimate, not-yet-penetrating sweep hit each tick), but the moment it got
   * close enough to end up a hair inside the beam - e.g. from `allowedPenetration`/`skin` tolerance
   * on a settle, or simply the discrete per-tick step distance overshooting the exact contact point
   * - the very next `move()` found nothing there at all (regression, found by walking under such a
   * beam in the example scene). Bullet's own `btKinematicCharacterController` (not used here - see
   * the class doc) avoids this with its own internal `recoverFromPenetration` step before every
   * sweep; this is that same step, built on the one discrete-overlap query Ammo's embind bindings
   * expose for it - `btCollisionWorld.contactTest`.
   */
  private recoverFromPenetration(pos: Point3): Point3 {
    const collisionWorld = this.world.dynamicAmmoWorld!;
    const skin = this.resolvedOptions.offset;
    const selfPtr = Ammo.getPointer(this.nativeBody);
    let corrected = pos;

    for (let i = 0; i < 4; i++) {
      this.position = corrected;

      let worstDistance = -skin;
      let worstPush: Point3 | null = null;
      const callback = new Ammo.ConcreteContactResultCallback();
      (callback as unknown as { addSingleResult: (...args: number[]) => number }).addSingleResult = (
        cpPtr: number,
        colObj0WrapPtr: number,
      ) => {
        const cp = (Ammo as unknown as AmmoWithWrapPointer).wrapPointer(cpPtr, Ammo.btManifoldPoint);
        const distance = cp.getDistance();
        if (distance >= worstDistance) {
          return 0;
        }
        // `m_normalWorldOnB` always points from collision object B towards collision object A -
        // which of the pair is "us" depends on Bullet's own internal ordering of the two bodies,
        // not call order, so orient the push-out direction based on which side we actually are
        const wrap0 = (Ammo as unknown as AmmoWithWrapPointer).wrapPointer(
          colObj0WrapPtr,
          Ammo.btCollisionObjectWrapper,
        );
        const weAreObjectA = Ammo.getPointer(wrap0.getCollisionObject()) === selfPtr;
        const n = cp.get_m_normalWorldOnB();
        const normal: Point3 = { x: n.x(), y: n.y(), z: n.z() };
        worstDistance = distance;
        worstPush = weAreObjectA ? normal : Pnt3.scalarMult(normal, -1);
        return 0;
      };

      collisionWorld.removeCollisionObject(this.nativeBody);
      try {
        collisionWorld.contactTest(this.nativeBody, callback);
      } finally {
        collisionWorld.addCollisionObject(this.nativeBody, this._ownCGsMask, this._interactWithCGsMask);
        Ammo.destroy(callback);
      }

      if (!worstPush) {
        break;
      }
      corrected = Pnt3.add(corrected, Pnt3.scalarMult(worstPush, -worstDistance + skin));
    }

    return corrected;
  }

  /**
   * A single `convexSweepTest` of this character's capsule from `from` to `to`, filtered by this
   * component's own collision groups - see this class's doc for why this replaces
   * `btKinematicCharacterController` entirely.
   *
   * Bug found empirically: `convexSweepTest` has no built-in "don't hit me" concept the way
   * `btKinematicCharacterController`'s own internal callback does (it excludes its ghost object by
   * identity, which the embind-exposed `ClosestConvexResultCallback` here has no hook to replicate
   * from JS) - so a sweep of this exact capsule shape, starting essentially at the ghost object's
   * own current position, was matching **the character's own collider** as the closest hit (fraction
   * ≈ 0, a plausible-looking but bogus surface normal), on every call, regardless of direction or
   * whether anything else was even present in the scene. This capped ordinary walking to a small,
   * direction-dependent fraction of the intended speed (a resting capsule always overlaps its own
   * ghost object's collider by definition, and floating-point noise in exactly how much made some
   * directions look worse than others). Fixed by pulling the ghost object out of the collision world
   * for the duration of the sweep - cheap (a handful of sweeps per tick, not per physics step) and
   * fully correct, unlike trying to filter by collision group/mask (this character's own group
   * generally isn't exclusive to it - e.g. it shares the default group with ordinary static
   * geometry - so masking it out would also hide real obstacles, not just self).
   */
  private sweep(from: Point3, to: Point3, allowedPenetration: number): SweepResult {
    const collisionWorld = this.world.dynamicAmmoWorld!;
    const rot = this.rotation;
    const fromT = new Ammo.btTransform();
    fromT.setIdentity();
    fromT.setOrigin(new Ammo.btVector3(from.x, from.y, from.z));
    fromT.setRotation(new Ammo.btQuaternion(rot.x, rot.y, rot.z, rot.w));
    const toT = new Ammo.btTransform();
    toT.setIdentity();
    toT.setOrigin(new Ammo.btVector3(to.x, to.y, to.z));
    toT.setRotation(new Ammo.btQuaternion(rot.x, rot.y, rot.z, rot.w));

    const callback = new Ammo.ClosestConvexResultCallback(
      new Ammo.btVector3(from.x, from.y, from.z),
      new Ammo.btVector3(to.x, to.y, to.z),
    );
    callback.set_m_collisionFilterGroup(this._ownCGsMask);
    callback.set_m_collisionFilterMask(this._interactWithCGsMask);

    collisionWorld.removeCollisionObject(this.nativeBody);
    try {
      collisionWorld.convexSweepTest(
        this.nativeShape as unknown as Ammo.btConvexShape,
        fromT,
        toT,
        callback,
        allowedPenetration,
      );
    } finally {
      collisionWorld.addCollisionObject(this.nativeBody, this._ownCGsMask, this._interactWithCGsMask);
    }

    const hasHit = callback.hasHit();
    let hitNormal: Point3 | undefined;
    let hitObjectPtr: number | undefined;
    if (hasHit) {
      const n = callback.get_m_hitNormalWorld();
      hitNormal = { x: n.x(), y: n.y(), z: n.z() };
      hitObjectPtr = Ammo.getPointer(callback.get_m_hitCollisionObject());
    }
    const fraction = hasHit ? callback.get_m_closestHitFraction() : 1;

    Ammo.destroy(fromT);
    Ammo.destroy(toT);
    Ammo.destroy(callback);

    return { hasHit, fraction, hitNormal, hitObjectPtr };
  }

  /**
   * Shoves a dynamic body the character bumped into this tick - kinematic character movement here
   * is a direct sweep-and-slide against the collision world (see this class's doc), not a real
   * rigid body integrated by the constraint solver, so nothing pushes a dynamic body out of the
   * way for free the way one rigid body pushes another; this is that push, added explicitly.
   *
   * Models the contact as a simple inelastic collision against a virtual body of mass
   * `resolvedOptions.pushMass` moving at `characterSpeed` (recovered by the caller from this tick's
   * horizontal displacement and `dt` - real m/s, not a raw per-tick distance): the hit body's
   * velocity along the push direction is driven towards `characterSpeed * pushMass / (pushMass +
   * bodyMass)`, so a body much lighter than `pushMass` ends up shoved at close to the character's
   * own speed and a much heavier one barely moves - both proportional to the actual mass
   * difference, unlike Bullet's own ghost-vs-rigid-body contact response (this character is a
   * `btPairCachingGhostObject`, which `btRigidBody::upcast` can't resolve back to a rigid body -
   * the constraint solver would otherwise treat it as an immovable fixed body, so the *positional*
   * penetration-recovery correction it generates lands entirely on the other body regardless of
   * that body's own mass; `CF_NO_CONTACT_RESPONSE` on this character's ghost object, see this
   * class's own doc, suppresses that native response so this method is the sole source of any push
   * a dynamic body feels). Only sets linear velocity, never touches angular - a pushed sphere still
   * visibly rolls (rather than just sliding), but that now comes entirely from its own subsequent
   * floor-friction contacts converting slide into roll, same as it would for any other sliding
   * object; no per-shape special-casing needed here (see `AmmoFactory.createRigidBodyFromShape`'s
   * `m_rollingFriction` note for why that conversion didn't use to happen at all).
   *
   * Only ever *adds* forward velocity along the push direction (never removes any) - a body already
   * outrunning the character in that direction (e.g. one that was already flung away by an earlier,
   * harder push) is left alone rather than being slowed back down to `characterSpeed`'s pace.
   */
  private pushDynamicBody(hitObjectPtr: number, direction: Point3, characterSpeed: number): void {
    const pushMass = this.resolvedOptions.pushMass;
    if (pushMass <= 0 || characterSpeed <= 1e-9) {
      return;
    }
    const comp = AmmoBodyComponent.nativeBodyReverseMap.get(hitObjectPtr);
    if (!(comp instanceof AmmoRigidBodyComponent)) {
      return;
    }
    const body = comp.nativeBody;
    const invMass = body.getInvMass();
    if (invMass <= 0) {
      // static or kinematic - nothing to push
      return;
    }
    const bodyMass = 1 / invMass;
    const pushSpeed = characterSpeed * (pushMass / (pushMass + bodyMass));

    const v = body.getLinearVelocity();
    const currentAlong = v.x() * direction.x + v.y() * direction.y + v.z() * direction.z;
    if (pushSpeed <= currentAlong) {
      return;
    }
    const delta = pushSpeed - currentAlong;
    body.activate(true);
    body.setLinearVelocity(
      new Ammo.btVector3(v.x() + direction.x * delta, v.y() + direction.y * delta, v.z() + direction.z * delta),
    );
  }

  refreshCG(): void {
    this.world.dynamicAmmoWorld?.removeCollisionObject(this.nativeBody);
    this.world.dynamicAmmoWorld?.addCollisionObject(this.nativeBody, this._ownCGsMask, this._interactWithCGsMask);
  }

  addToWorld(world: AmmoGgWorld): void {
    super.addToWorld(world);
    this.world.dynamicAmmoWorld?.addCollisionObject(this.nativeBody, this._ownCGsMask, this._interactWithCGsMask);
  }

  removeFromWorld(world: AmmoGgWorld, dispose?: boolean): void {
    this.world.dynamicAmmoWorld?.removeCollisionObject(this.nativeBody);
    super.removeFromWorld(world, dispose);
  }

  dispose(): void {
    super.dispose();
    try {
      Ammo.destroy(this.nativeShape);
    } catch {
      // pass - mirrors the same defensive try/catch AmmoBodyComponent.dispose() uses for the body
    }
  }

  clone(): AmmoCharacterControllerComponent {
    return new AmmoCharacterControllerComponent(
      this.world,
      {
        radius: this.radius,
        centersDistance: this.centersDistance,
        offset: this.resolvedOptions.offset,
        maxStepHeight: this.resolvedOptions.maxStepHeight,
        minStepWidth: this.resolvedOptions.minStepWidth,
        maxSlopeClimbAngleRad: this.resolvedOptions.maxSlopeClimbAngleRad,
        snapToGroundDistance: this.resolvedOptions.snapToGroundDistance,
        up: this._up,
        ownCollisionGroups: this.ownCollisionGroups,
        interactWithCollisionGroups: this.interactWithCollisionGroups,
      },
      { position: this.position, rotation: this.rotation },
    );
  }
}
