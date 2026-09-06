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
};

/** btCollisionObject::CF_CHARACTER_OBJECT - not exposed as a numeric constant by the Ammo.js
 * embind bindings (only as an opaque preprocessor-define string type), so it's inlined here as the
 * literal Bullet uses internally, same as `AmmoTriggerComponent`/`AmmoFactory` do for
 * `CF_NO_CONTACT_RESPONSE` (4) elsewhere in this package. */
const CF_CHARACTER_OBJECT = 16;

type SweepResult = {
  hasHit: boolean;
  /** 0..1 fraction of the requested delta that was actually clear to move through. */
  fraction: number;
  hitNormal?: Point3;
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
    ghostObject.setCollisionFlags(CF_CHARACTER_OBJECT);
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
  move(desiredTranslation: Point3): void {
    const collisionWorld = this.world.dynamicAmmoWorld;
    if (!collisionWorld) {
      // not part of an initialized world (or not yet added) - nothing to sweep against
      return;
    }

    const up = this._up;
    const skin = this.resolvedOptions.offset;
    const vertical = Pnt3.scalarMult(up, Pnt3.dot(desiredTranslation, up));
    const horizontal = Pnt3.sub(desiredTranslation, vertical);

    let pos = this.position;

    if (Pnt3.len(horizontal) > 1e-9) {
      pos = this.moveHorizontalWithStepAndSlide(pos, horizontal, up, skin);
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
      const movingDown = Pnt3.dot(vertical, up) < 0;
      const result = this.sweep(pos, Pnt3.add(pos, vertical), skin);
      pos = Pnt3.add(pos, Pnt3.scalarMult(vertical, result.fraction));
      if (result.hasHit && movingDown && this.isWalkableNormal(result.hitNormal!, up)) {
        grounded = true;
        groundNormal = result.hitNormal!;
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
   * Sweeps the horizontal delta; if blocked, attempts a single "step up by maxStepHeight, retry
   * horizontally, settle back down" pass (for small ledges/stairs), otherwise slides once along the
   * remaining blocked distance, projected onto the obstacle's surface plane.
   */
  private moveHorizontalWithStepAndSlide(start: Point3, horizontal: Point3, up: Point3, skin: number): Point3 {
    let pos = start;
    let result = this.sweep(pos, Pnt3.add(pos, horizontal), skin);
    const blocked = result.hasHit && result.fraction < 0.999;

    let raised = 0;
    if (blocked && this.resolvedOptions.maxStepHeight > 0) {
      const upSweep = this.sweep(pos, Pnt3.add(pos, Pnt3.scalarMult(up, this.resolvedOptions.maxStepHeight)), skin);
      const raisedPos = Pnt3.add(pos, Pnt3.scalarMult(up, this.resolvedOptions.maxStepHeight * upSweep.fraction));
      const retry = this.sweep(raisedPos, Pnt3.add(raisedPos, horizontal), skin);
      if (retry.fraction > result.fraction + 1e-6) {
        // stepping up actually cleared more horizontal distance than staying flat - use it
        raised = Pnt3.dist(pos, raisedPos);
        pos = Pnt3.add(raisedPos, Pnt3.scalarMult(horizontal, retry.fraction));
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
    // register an entry hit, so start comfortably above that worst case instead.
    const startMargin = Math.max(skin * 4, 0.02);
    const from = Pnt3.add(bottom, Pnt3.scalarMult(up, startMargin));
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
    if (hasHit) {
      const n = callback.get_m_hitNormalWorld();
      hitNormal = { x: n.x(), y: n.y(), z: n.z() };
    }
    const fraction = hasHit ? callback.get_m_closestHitFraction() : 1;

    Ammo.destroy(fromT);
    Ammo.destroy(toT);
    Ammo.destroy(callback);

    return { hasHit, fraction, hitNormal };
  }

  refreshCG(): void {
    this.world.dynamicAmmoWorld?.removeCollisionObject(this.nativeBody);
    this.world.dynamicAmmoWorld?.addCollisionObject(this.nativeBody, this._ownCGsMask, this._interactWithCGsMask);
  }

  addToWorld(world: AmmoGgWorld): void {
    super.addToWorld(world);
    this.world.dynamicAmmoWorld?.addCollisionObject(this.nativeBody, this._ownCGsMask, this._interactWithCGsMask);
  }

  removeFromWorld(world: AmmoGgWorld): void {
    this.world.dynamicAmmoWorld?.removeCollisionObject(this.nativeBody);
    super.removeFromWorld(world);
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
