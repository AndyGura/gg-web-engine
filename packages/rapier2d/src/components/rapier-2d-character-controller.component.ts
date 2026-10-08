import {
  BitMask,
  CharacterController2dOptions,
  CollisionGroup,
  DebugBody2DSettings,
  ICharacterController2dComponent,
  IEntity,
  Pnt2,
  Point2,
  warnOnce,
} from '@gg-web-engine/core';
import {
  ActiveCollisionTypes,
  ActiveEvents,
  Collider,
  InteractionGroups,
  KinematicCharacterController,
  QueryFilterFlags,
  RigidBody,
  RigidBodyDesc,
  Vector2,
} from '@dimforge/rapier2d-compat';
import { Rapier2dWorldComponent } from './rapier-2d-world.component';
import { Rapier2dRigidBodyComponent } from './rapier-2d-rigid-body.component';
import { Rapier2dGgWorld, Rapier2dPhysicsTypeDocRepo } from '../types';

/**
 * A capsule-shaped kinematic character controller backed by Rapier's own `KinematicCharacterController`
 * (`world.createCharacterController`) - the 2D counterpart of `Rapier3dCharacterControllerComponent`,
 * which this mirrors closely (2D `Vector2`/scalar rotation instead of 3D `Vector3`/`Quaternion`, the
 * snap-to-ground/autostep-vs-jump guard, the hand-rolled `pushDynamicBodies`, the "reuse the best-
 * `up`-aligned collision normal, falling back to the previous tick's rather than a flat guess"
 * ground-normal derivation - all identical). See that class's own doc for the full rationale behind
 * each of these; only 2D-specific notes are repeated here. One deliberate divergence: `move()` here
 * sweeps `desiredTranslation` as two single-axis passes (horizontal, then any remaining vertical
 * intent) rather than 3D's single combined sweep - see this method's own doc for why.
 */
export class Rapier2dCharacterControllerComponent implements ICharacterController2dComponent<Rapier2dPhysicsTypeDocRepo> {
  public entity: IEntity | null = null;
  public name: string = '';

  public readonly radius: number;
  public readonly centersDistance: number;

  private _up: Point2;

  public get up(): Point2 {
    return this._up;
  }

  public set up(value: Point2) {
    this._up = Pnt2.norm(value);
    this._nativeController?.setUp(new Vector2(this._up.x, this._up.y));
  }

  private _isGrounded: boolean = false;

  public get isGrounded(): boolean {
    return this._isGrounded;
  }

  private _groundNormal: Point2 | null = null;

  public get groundNormal(): Point2 | null {
    return this._groundNormal;
  }

  /** See `ICharacterController2dComponent.ignoredBodies`'s doc. */
  public readonly ignoredBodies: Set<Rapier2dRigidBodyComponent> = new Set();

  protected _nativeBody: RigidBody | null = null;
  protected _nativeCollider: Collider | null = null;
  protected _nativeController: KinematicCharacterController | null = null;

  public get nativeBody(): RigidBody | null {
    return this._nativeBody;
  }

  public get nativeCollider(): Collider | null {
    return this._nativeCollider;
  }

  public get nativeController(): KinematicCharacterController | null {
    return this._nativeController;
  }

  public readonly debugBodySettings: DebugBody2DSettings;

  public get position(): Point2 {
    return Pnt2.clone(this._nativeBody ? this._nativeBody.translation() : this._bodyDescr.translation);
  }

  public set position(value: Point2) {
    if (this._nativeBody) {
      const v = new Vector2(value.x, value.y);
      this._nativeBody.setTranslation(v, true);
      this._nativeBody.setNextKinematicTranslation(v);
      this.syncColliderTransform();
    } else {
      this._bodyDescr.setTranslation(value.x, value.y);
    }
  }

  public get rotation(): number {
    return this._nativeBody ? this._nativeBody.rotation() : this._bodyDescr.rotation;
  }

  public set rotation(value: number) {
    if (this._nativeBody) {
      this._nativeBody.setRotation(value, true);
      this._nativeBody.setNextKinematicRotation(value);
      this.syncColliderTransform();
    } else {
      this._bodyDescr.setRotation(value);
    }
  }

  protected collisionGroups: InteractionGroups = BitMask.full(32);

  public get interactWithCollisionGroups(): ReadonlyArray<CollisionGroup> {
    return BitMask.unpack(this.collisionGroups, 16);
  }

  public set interactWithCollisionGroups(value: ReadonlyArray<CollisionGroup> | 'all') {
    let mask = value === 'all' ? BitMask.full(16) : BitMask.pack(value, 16);
    mask = mask | (this.collisionGroups & (BitMask.full(16) << 16));
    if (mask === this.collisionGroups) {
      return;
    }
    this.collisionGroups = mask;
    this._nativeCollider?.setCollisionGroups(this.collisionGroups);
  }

  public get ownCollisionGroups(): ReadonlyArray<CollisionGroup> {
    return BitMask.unpack(this.collisionGroups >> 16, 16);
  }

  public set ownCollisionGroups(value: ReadonlyArray<CollisionGroup> | 'all') {
    let mask = value === 'all' ? BitMask.full(16) : BitMask.pack(value, 16);
    mask = (mask << 16) | (this.collisionGroups & BitMask.full(16));
    if (mask === this.collisionGroups) {
      return;
    }
    this.collisionGroups = mask;
    this._nativeCollider?.setCollisionGroups(this.collisionGroups);
  }

  constructor(
    protected readonly world: Rapier2dWorldComponent,
    protected readonly options: Required<CharacterController2dOptions>,
    protected _bodyDescr: RigidBodyDesc,
  ) {
    this.radius = options.radius;
    this.centersDistance = options.centersDistance;
    this._up = Pnt2.norm(options.up);
    this.debugBodySettings = new DebugBody2DSettings(
      { type: 'RIGID_DYNAMIC', sleeping: () => false },
      { shape: 'CAPSULE', radius: this.radius, centersDistance: this.centersDistance },
    );
    this.ownCollisionGroups = options.ownCollisionGroups;
    this.interactWithCollisionGroups = options.interactWithCollisionGroups;
  }

  private syncColliderTransform(): void {
    this.world.nativeWorld.propagateModifiedBodyPositionsToColliders();
  }

  private ignoredBodiesFilterPredicate(): ((collider: Collider) => boolean) | undefined {
    if (this.ignoredBodies.size === 0) {
      return undefined;
    }
    const ignoredHandles = new Set<number>();
    for (const body of this.ignoredBodies) {
      if (body.nativeBody) {
        ignoredHandles.add(body.nativeBody.handle);
      }
    }
    if (ignoredHandles.size === 0) {
      return undefined;
    }
    return (collider: Collider) => {
      const parent = collider.parent();
      return !parent || !ignoredHandles.has(parent.handle);
    };
  }

  move(desiredTranslation: Point2, dt?: number): void {
    if (!this._nativeBody || !this._nativeCollider || !this._nativeController) {
      return;
    }
    this.syncColliderTransform();

    const vertAmount = Pnt2.dot(desiredTranslation, this._up);
    const movingUp = vertAmount > 1e-9;
    if (movingUp) {
      this._nativeController.disableSnapToGround();
      this._nativeController.disableAutostep();
    } else {
      if (this.options.snapToGroundDistance > 0) {
        this._nativeController.enableSnapToGround(this.options.snapToGroundDistance);
      }
      if (this.options.maxStepHeight > 0) {
        this._nativeController.enableAutostep(this.options.maxStepHeight, this.options.minStepWidth, true);
      }
    }

    const filterPredicate = this.ignoredBodiesFilterPredicate();
    const sweep = (translation: Point2): Vector2 => {
      this._nativeController!.computeColliderMovement(
        this._nativeCollider!,
        new Vector2(translation.x, translation.y),
        // see `Rapier3dCharacterControllerComponent.move`'s doc for why `EXCLUDE_SENSORS` is required
        QueryFilterFlags.EXCLUDE_SENSORS,
        undefined,
        filterPredicate,
      );
      return this._nativeController!.computedMovement();
    };

    // `horizPart`/`vertPart` are constructed so each has an *exactly* (bit-for-bit) zero component
    // along the other axis - not merely a small one - see the native-bug note below for why that
    // exactness matters and plain `desiredTranslation` (which can carry ~1e-16 floating-point noise
    // on the axis its caller considers "unused", e.g. from `Pnt2.add`/`scalarMult` arithmetic
    // upstream in `CharacterController2dEntity`) is never safe to hand to `computeColliderMovement`
    // directly.
    const horizPart = Pnt2.sub(desiredTranslation, Pnt2.scalarMult(this._up, vertAmount));
    const vertPart = Pnt2.scalarMult(this._up, vertAmount);
    const hasHoriz = Pnt2.len(horizPart) > 1e-9;
    const hasVert = Math.abs(vertAmount) > 1e-9;

    // Work around a native bug found empirically in this pinned `@dimforge/rapier2d-compat` build:
    // `computeColliderMovement`, when the character starts the sweep already resting flush on a
    // flat floor, and `desiredTranslation` has *any* non-zero component pointing away from `up`
    // (i.e. downward - any magnitude at all, even ~1e-16 floating-point noise carried on an axis the
    // caller never intended to move along) together with a non-zero horizontal component, returns an
    // almost-exactly-zero result for the ENTIRE movement (horizontal included), regardless of
    // `enableSnapToGround`/`enableAutostep`, regardless of how large the desired horizontal distance
    // is, and regardless of there being no actual obstacle in that direction (`computedCollision(0)`'s
    // own normal is flat, near-`up`, not a wall) - confirmed directly against the native controller
    // with the character body moved into open space first (ruling out any stale broad-phase/collider-
    // transform-sync effect), and by feeding synthetic desired vectors of every sign combination at
    // the exact resting height (a *pure* horizontal or *pure* vertical desired translation, with the
    // other component bit-for-bit `0`, is unaffected regardless of magnitude - only a genuinely mixed
    // vector triggers it). Whatever this degenerate result resolves to for a given exact flush
    // contact configuration is direction-dependent and self-reinforcing: a resolution of "fully
    // blocked" leaves the position unchanged, so the identical degenerate input recurs next tick too
    // - this is the concrete mechanism behind the "walking left gets stuck at discrete positions
    // until I jump" symptom (jumping's own `movingUp` branch above always disables both native
    // features outright and is not itself the trigger; the *direction* that ends up "stuck" versus
    // "recovers next tick" was observed to depend on the exact numeric contact configuration, not on
    // left/right consistently - so this is fixed for both directions, not just one). A one-tick
    // `computedGrounded()` false reading immediately after starting horizontal movement from rest is
    // enough to introduce exactly this kind of tiny genuine (non-noise) vertical component into
    // `desiredTranslation` via `CharacterController2dEntity`'s own gravity integration, making this
    // reachable from perfectly ordinary walking, not just edge-case input.
    //
    // Fixed by never handing the native controller a mixed vector at all: split into two single-axis
    // sweeps - horizontal first (with snapping/autostep exactly as decided above, so ground-following
    // on a downward step/slope while walking still works), then any remaining vertical intent
    // (fall/jump takeoff/snap-glue) as its own pure-`up` sweep from the post-horizontal position - and
    // always sweep with `horizPart`/`vertPart` (exact-zero orthogonal component by construction)
    // rather than raw `desiredTranslation`, even on the common single-axis-only path, since that raw
    // vector's own "zero" axis is exactly the kind of noisy near-zero value this bug treats as
    // "non-zero" as shown above.
    //
    // `start` is the position at the top of this tick, captured once. Each phase below applies its
    // own computed movement to the body immediately (so a following phase's sweep sees the right
    // starting transform), accumulating into `computed` - the final write derives strictly from
    // `start + computed`, never from a fresh `translation()` read, since that would already include
    // an earlier phase's movement and double-count it.
    const start = this._nativeBody.translation();
    let computed: Point2 = { x: 0, y: 0 };
    const applyPhase = (delta: Vector2): void => {
      computed = Pnt2.add(computed, { x: delta.x, y: delta.y });
      const next = new Vector2(start.x + computed.x, start.y + computed.y);
      this._nativeBody!.setTranslation(next, true);
      this._nativeBody!.setNextKinematicTranslation(next);
      this.syncColliderTransform();
    };

    // `numComputedCollisions()`/`computedCollision()` only ever reflect the most recent
    // `computeColliderMovement` call - when both phases run below, the vertical sweep's own list
    // would silently overwrite the horizontal one by the time `pushDynamicBodies` (below) needs it,
    // losing any dynamic body the horizontal leg actually bumped into. Captured into
    // `horizontalHitBodies` right after the horizontal sweep, before the vertical sweep (if any) can
    // overwrite it.
    const horizontalHitBodies: RigidBody[] = [];
    const collectHorizontalHitBodies = (): void => {
      const count = this._nativeController!.numComputedCollisions();
      for (let i = 0; i < count; i++) {
        const body = this._nativeController!.computedCollision(i)?.collider?.parent();
        if (body) {
          horizontalHitBodies.push(body);
        }
      }
    };

    if (hasHoriz && hasVert) {
      applyPhase(sweep(horizPart));
      collectHorizontalHitBodies();
      applyPhase(sweep(vertPart));
    } else if (hasVert) {
      applyPhase(sweep(vertPart));
    } else {
      // purely horizontal, or a fully negligible desired translation (still swept once, with an
      // exact-zero vertical component, to refresh `isGrounded`/`groundNormal` for this tick).
      applyPhase(sweep(horizPart));
      collectHorizontalHitBodies();
    }

    this._isGrounded = this._nativeController.computedGrounded();
    this._groundNormal = this.computeGroundNormal();

    this.pushDynamicBodies(horizontalHitBodies, desiredTranslation, dt);
  }

  /**
   * Mirrors `Rapier3dCharacterControllerComponent.pushDynamicBodies` exactly, projected into 2D -
   * except `hitBodies` is passed in by the caller rather than read fresh from
   * `this._nativeController.numComputedCollisions()`/`computedCollision()` here, since by the time
   * this runs those may already reflect a *later* sweep than the horizontal one this method cares
   * about (see `move()`'s own `collectHorizontalHitBodies`).
   */
  private pushDynamicBodies(hitBodies: RigidBody[], desiredTranslation: Point2, dt: number | undefined): void {
    const pushMass = this.options.pushMass;
    if (pushMass <= 0 || hitBodies.length === 0) {
      return;
    }
    const vertical = Pnt2.scalarMult(this._up, Pnt2.dot(desiredTranslation, this._up));
    const horizontal = Pnt2.sub(desiredTranslation, vertical);
    const horizLen = Pnt2.len(horizontal);
    if (horizLen <= 1e-9) {
      return;
    }
    if (!dt || dt <= 1e-9) {
      warnOnce(
        '[Rapier2dCharacterControllerComponent] move() was called without `dt` while `pushMass` > ' +
          '0 - skipping this dynamic-body push rather than approximating character speed from raw ' +
          'per-tick displacement (which would understate push force by roughly 1/dt). Pass the ' +
          'real tick delta (seconds) as the third argument to move() to enable pushing dynamic bodies.',
      );
      return;
    }
    const direction = Pnt2.scalarMult(horizontal, 1 / horizLen);
    const characterSpeed = horizLen / dt;

    for (const body of hitBodies) {
      if (!body.isDynamic()) {
        continue;
      }
      const bodyMass = body.mass();
      if (bodyMass <= 0) {
        continue;
      }
      const pushSpeed = characterSpeed * (pushMass / (pushMass + bodyMass));
      const v = body.linvel();
      const currentAlong = v.x * direction.x + v.y * direction.y;
      if (pushSpeed <= currentAlong) {
        continue;
      }
      const delta = pushSpeed - currentAlong;
      body.setLinvel({ x: v.x + direction.x * delta, y: v.y + direction.y * delta }, true);
    }
  }

  /** Mirrors `Rapier3dCharacterControllerComponent.computeGroundNormal` exactly, projected into 2D -
   * see that method's own doc for the full rationale (why a `0`-collision grounded call must reuse
   * the previous tick's normal rather than guessing flat `up`). */
  private computeGroundNormal(): Point2 | null {
    if (!this._isGrounded || !this._nativeController) {
      return null;
    }
    const count = this._nativeController.numComputedCollisions();
    let best: Point2 | null = null;
    let bestDot = -Infinity;
    for (let i = 0; i < count; i++) {
      const collision = this._nativeController.computedCollision(i);
      if (!collision?.normal1) {
        continue;
      }
      const normal = Pnt2.clone(collision.normal1);
      const dot = Pnt2.dot(normal, this._up);
      if (dot > bestDot) {
        bestDot = dot;
        best = normal;
      }
    }
    return best ?? this._groundNormal ?? Pnt2.clone(this._up);
  }

  clone(): Rapier2dCharacterControllerComponent {
    const pos = this.position;
    const rot = this.rotation;
    const bd = RigidBodyDesc.kinematicPositionBased();
    bd.setTranslation(pos.x, pos.y);
    bd.setRotation(rot);
    const comp = new Rapier2dCharacterControllerComponent(this.world, this.options, bd);
    // `this.options.up` is only ever read once, in the constructor - the live `up` setter (used by
    // any caller that rotates the character after construction) never writes back to it, so it goes
    // stale the moment `up` changes; copy the CURRENT value here instead, the same way
    // `collisionGroups` already does below.
    comp.up = this.up;
    comp.collisionGroups = this.collisionGroups;
    return comp;
  }

  addToWorld(world: Rapier2dGgWorld): void {
    if (world.physicsWorld != this.world) {
      throw new Error('Rapier2D bodies cannot be shared between different worlds');
    }
    const nativeWorld = this.world.nativeWorld;
    this._nativeBody = nativeWorld.createRigidBody(this._bodyDescr);
    const colliderDescr = this.world.factory.createColliderDescr({
      shape: 'CAPSULE',
      radius: this.radius,
      centersDistance: this.centersDistance,
    })[0];
    // see `Rapier3dCharacterControllerComponent.addToWorld`'s doc for why both of these are needed
    // for `Rapier2dWorldComponent.dispatchCollisionEvents` to ever see a pair involving this
    // character controller
    colliderDescr.setActiveCollisionTypes(ActiveCollisionTypes.ALL);
    colliderDescr.setActiveEvents(ActiveEvents.COLLISION_EVENTS);
    this._nativeCollider = nativeWorld.createCollider(colliderDescr, this._nativeBody);
    this._nativeCollider.setCollisionGroups(this.collisionGroups);

    this._nativeController = nativeWorld.createCharacterController(this.options.offset);
    this._nativeController.setUp(new Vector2(this._up.x, this._up.y));
    this._nativeController.setMaxSlopeClimbAngle(this.options.maxSlopeClimbAngleRad);
    if (this.options.maxStepHeight > 0) {
      this._nativeController.enableAutostep(this.options.maxStepHeight, this.options.minStepWidth, true);
    }
    if (this.options.snapToGroundDistance > 0) {
      this._nativeController.enableSnapToGround(this.options.snapToGroundDistance);
    }
    this.world.handleIdEntityMap.set(this._nativeBody.handle, this);
    // Rapier's own `setApplyImpulsesToDynamicBodies` is deliberately not used here either - see
    // `Rapier3dCharacterControllerComponent.addToWorld`'s doc for why (confirmed unstable on the 3D
    // side; not re-verified independently for 2D, but there is no reason to expect the 2D character
    // controller's impulse-resolution code path to behave differently, and the hand-rolled
    // `pushDynamicBodies` above already covers the same contract without it).

    this.world.added$.next(this);
  }

  removeFromWorld(world: Rapier2dGgWorld, dispose?: boolean): void {
    if (world.physicsWorld != this.world) {
      throw new Error('Rapier2D bodies cannot be shared between different worlds');
    }
    if (this._nativeController) {
      this.world.nativeWorld.removeCharacterController(this._nativeController);
      this._nativeController = null;
    }
    if (this._nativeBody) {
      // `addToWorld` rebuilds the body from `_bodyDescr`: keep the pose it has now
      const t = this._nativeBody.translation();
      this._bodyDescr.setTranslation(t.x, t.y);
      this._bodyDescr.setRotation(this._nativeBody.rotation());
      this.world.handleIdEntityMap.delete(this._nativeBody.handle);
      if (this._nativeCollider) {
        this.world.nativeWorld.removeCollider(this._nativeCollider, false);
        this._nativeCollider = null;
      }
      this.world.nativeWorld.removeRigidBody(this._nativeBody);
      this._nativeBody = null;
    }
    this.world.removed$.next(this);
  }

  dispose(): void {
    if (this._nativeBody) {
      this.removeFromWorld({ physicsWorld: this.world } as any as Rapier2dGgWorld, true);
    }
  }
}
