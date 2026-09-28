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
import { Bodies, Body, Collision, Composite, Detector, Query, Vector } from 'matter-js';
import { MatterRigidBodyComponent } from './matter-rigid-body.component';
import { MatterTriggerComponent } from './matter-trigger.component';
import { MatterWorldComponent } from './matter-world.component';
import { MatterGgWorld, MatterPhysicsTypeDocRepo } from '../types';

const DEFAULT_OPTIONS: Required<
  Omit<CharacterController2dOptions, 'radius' | 'centersDistance' | 'ownCollisionGroups'>
> = {
  offset: 0.01,
  maxStepHeight: 0.3,
  minStepWidth: 0.2,
  maxSlopeClimbAngleRad: (50 * Math.PI) / 180,
  snapToGroundDistance: 0.3,
  up: Pnt2.nY,
  interactWithCollisionGroups: 'all',
  pushMass: 80,
};

/** Result of marching this character's phantom body along a single axis (see `marchMove`'s doc). */
type AxisMoveResult = {
  pos: Point2;
  blocked: boolean;
  /** The blocking contact's normal, oriented towards the character (see `normalTowardCharacter`) -
   * only set when `blocked`. */
  normal: Point2 | null;
  /** Every body this character's phantom shape overlapped at the final (possibly blocked) position
   * this call settled on - used by `move()` to find dynamic bodies to push. Empty when the whole
   * move completed with no contact at all. */
  overlappingBodies: Body[];
};

/**
 * A capsule-shaped kinematic character controller implemented as a direct discrete-query
 * sweep-and-slide mover, driven entirely by this class's own `move()` - the 2D counterpart of a
 * from-scratch native-engine character mover (see `gg-engine-physics-adapter`'s own section on this
 * general pattern).
 *
 * **Why this isn't built on `createRigidBody`/a `kinematic_pos` body**: matter-js has no native
 * kinematic body concept at all (see `MatterFactory.transformOptions`'s doc) - a `kinematic_pos`/
 * `kinematic_vel` request there falls back to a plain `isStatic: true` body, which never moves and
 * never pushes/wakes anything. This component instead constructs its own `Matter.Body` directly (a
 * capsule via `Bodies.rectangle` with a `chamfer`, matching `MatterFactory.createRigidBody`'s own
 * `CAPSULE` case), marks it `isStatic: true` so matter's own `Engine.update` never touches it, and
 * **never adds it to `Composite`/`engine.world` at all** - there is no need to, since every query this
 * class issues (`Matter.Query.collides`) is run directly against this body and an explicit list of
 * other bodies, not through matter's own broadphase/`Engine.update` pipeline. This also means
 * matter-js's own per-engine `collisionFilter`-aware broadphase (`Detector.canCollide`) never runs for
 * this body either - `collectObstacles()` below replicates that exact category/mask check by hand
 * before ever calling `Query.collides`, since that function tests raw geometry with no collision-group
 * awareness of its own.
 *
 * **Why movement is substep-marched rather than a single discrete overlap test at the final
 * position**: matter-js has no continuous collision detection at all (see `MatterFactory
 * .transformOptions`'s own `ccd` note) and `Matter.Query.collides`/`Collision.collides` are purely
 * discrete overlap tests at whatever transform a body currently has - matter-js exposes no
 * swept/time-of-impact query to call instead. A
 * single test-then-clamp at the fully-displaced candidate position would tunnel clean through any
 * obstacle thinner than the requested displacement (a large single-tick `move()` call, or a thin wall,
 * would simply never register contact at all). `marchMove` compensates by subdividing the requested
 * delta into substeps no longer than `min(radius, 0.1)` and re-querying after each one, stopping at the
 * first substep that would overlap something - a standard workaround for discrete-only collision
 * detection, and the direct 2D analog of what a sweep primitive gives other backends for free.
 *
 * **Collision normal convention**: `Matter.Collision`'s own `collision.bodyA`/`collision.bodyB` (and
 * `parentA`/`parentB`) are reassigned by ascending `Body.id`, not by the order two bodies were passed
 * into `Collision.collides`/`Query.collides` - and the final `collision.normal` is oriented so that
 * `dot(normal, bodyB.position - bodyA.position) <= 0` always holds (verified empirically against
 * `Collision.js`'s own flip check; its inline comment claims the opposite, "facing away from bodyA",
 * which does not match the code - see `gg-engine-physics-adapter-matter`'s own note on this same
 * gotcha for the engine-wide `collisionStart`/`collisionEnd` event wiring). Concretely this means the
 * final normal always points *towards* `collision.bodyA`/`parentA`, away from `bodyB`/`parentB`,
 * regardless of which side of the original `Query.collides(body, bodies)` call each one came from -
 * `normalTowardCharacter` below re-derives a consistent "points away from the obstacle, towards this
 * character" direction from that by comparing `parentA`/`parentB` against this character's own native
 * body, not by assuming a fixed argument order.
 *
 * **Ground overlap for `Trigger2dEntity`**: since this character's phantom body is deliberately never
 * added to matter's own `Composite`, matter's native `collisionStart`/`collisionEnd` engine events
 * (what `MatterTriggerComponent`'s own enter/exit detection is normally driven by) can never fire for
 * it - there is no pair for the engine to ever notice. `MatterTriggerComponent.checkOverlaps()`
 * (already called once per tick by `Trigger2dEntity`, previously a no-op for matter-js since ordinary
 * rigid-body overlaps are handled by those native events instead) now *additionally* polls every
 * `MatterCharacterControllerComponent` currently in the world via `Query.collides` each time it's
 * called, entirely independently of the native event path - this was the natural fit given
 * `checkOverlaps()` already existed as a per-tick hook with nothing else needing it for matter-js,
 * rather than inventing a second, differently-shaped mechanism.
 *
 * **Colliding with other character controllers**: `collectObstacles()` below includes every other
 * `MatterCharacterControllerComponent` currently in the world (found via `this.world.children`, not
 * `Composite.allBodies`, for the same reason as the previous paragraph) alongside ordinary bodies -
 * two characters block each other's movement the same way any other obstacle does.
 *
 * **Divergence from the interface's own options**: `minStepWidth` is accepted but not honored - see
 * `applyStepAssist`'s own doc for why.
 */
export class MatterCharacterControllerComponent implements ICharacterController2dComponent<MatterPhysicsTypeDocRepo> {
  public entity: IEntity | null = null;
  public name: string = '';

  public readonly radius: number;
  public readonly centersDistance: number;
  public readonly nativeBody: Body;

  private readonly options: Required<CharacterController2dOptions>;

  private _up: Point2;
  public get up(): Point2 {
    return this._up;
  }

  public set up(value: Point2) {
    this._up = Pnt2.norm(value);
  }

  private _isGrounded: boolean = false;
  public get isGrounded(): boolean {
    return this._isGrounded;
  }

  private _groundNormal: Point2 | null = null;
  public get groundNormal(): Point2 | null {
    return this._groundNormal;
  }

  /** See `ICharacterController2dComponent.ignoredBodies`'s doc. Consulted fresh by `collectObstacles`
   * every `move()` call. */
  public readonly ignoredBodies: Set<MatterRigidBodyComponent> = new Set();

  private _added: boolean = false;

  public readonly debugBodySettings: DebugBody2DSettings;

  public get position(): Point2 {
    return Pnt2.clone(this.nativeBody.position);
  }

  public set position(value: Point2) {
    Body.setPosition(this.nativeBody, Vector.create(value.x, value.y));
  }

  public get rotation(): number {
    return this.nativeBody.angle;
  }

  public set rotation(value: number) {
    Body.setAngle(this.nativeBody, value);
  }

  protected _ownCGsMask = BitMask.full(16);
  protected _interactWithCGsMask = BitMask.full(16);

  public get ownCollisionGroups(): ReadonlyArray<CollisionGroup> {
    return BitMask.unpack(this._ownCGsMask, 16);
  }

  public set ownCollisionGroups(value: ReadonlyArray<CollisionGroup> | 'all') {
    this._ownCGsMask = value === 'all' ? BitMask.full(16) : BitMask.pack(value, 16);
    this.updateCollisionFilter();
  }

  public get interactWithCollisionGroups(): ReadonlyArray<CollisionGroup> {
    return BitMask.unpack(this._interactWithCGsMask, 16);
  }

  public set interactWithCollisionGroups(value: ReadonlyArray<CollisionGroup> | 'all') {
    this._interactWithCGsMask = value === 'all' ? BitMask.full(16) : BitMask.pack(value, 16);
    this.updateCollisionFilter();
  }

  private updateCollisionFilter(): void {
    this.nativeBody.collisionFilter = {
      ...this.nativeBody.collisionFilter,
      category: this._ownCGsMask,
      mask: this._interactWithCGsMask,
    };
  }

  constructor(
    protected readonly world: MatterWorldComponent,
    options: CharacterController2dOptions,
    transform?: { position?: Point2; rotation?: number },
  ) {
    this.options = {
      ...DEFAULT_OPTIONS,
      ownCollisionGroups: [world.mainCollisionGroup],
      ...options,
    };
    this.radius = options.radius;
    this.centersDistance = options.centersDistance;
    this._up = Pnt2.norm(this.options.up);

    this.nativeBody = Bodies.rectangle(0, 0, options.radius * 2, options.centersDistance + options.radius * 2, {
      isStatic: true,
      chamfer: { radius: options.radius },
    });
    Body.setPosition(this.nativeBody, Vector.create(transform?.position?.x || 0, transform?.position?.y || 0));
    Body.setAngle(this.nativeBody, transform?.rotation || 0);

    this.debugBodySettings = new DebugBody2DSettings(
      // A kinematic character never truly "sleeps" the way a dynamic rigid body does - it's either
      // being actively driven every tick or idle at rest; report it as always-awake.
      { type: 'RIGID_DYNAMIC', sleeping: () => false },
      { shape: 'CAPSULE', radius: this.radius, centersDistance: this.centersDistance },
    );

    this.ownCollisionGroups = this.options.ownCollisionGroups;
    this.interactWithCollisionGroups = this.options.interactWithCollisionGroups;
  }

  /**
   * Every other body currently in the world this character's own queries must consider - excludes
   * sensors (triggers never physically block anything, see `ITrigger2dComponent`), everything in
   * `ignoredBodies` (consulted fresh here, every call), and anything this character's own collision
   * groups wouldn't interact with anyway (`Query.collides`/`Collision.collides` test raw geometry
   * only and know nothing about `collisionFilter`, unlike matter's own `Detector` - so `canCollideWith`
   * calls `Detector.canCollide` directly against this character's own `nativeBody.collisionFilter`,
   * which the `ownCollisionGroups`/`interactWithCollisionGroups` setters keep in sync).
   *
   * Also includes every *other* `MatterCharacterControllerComponent` currently in the world, via its
   * own phantom `nativeBody` - without this, two character controllers could freely overlap and pass
   * straight through each other, since neither one's phantom body is ever added to
   * `Composite`/`engine.world` (see this class's own doc) and so neither is ever a candidate for the
   * other's queries through `Composite.allBodies` alone.
   */
  private collectObstacles(): Body[] {
    const matterWorld = this.world.matterWorld;
    if (!matterWorld) {
      return [];
    }
    const ignoredNative = new Set<Body>();
    for (const body of this.ignoredBodies) {
      ignoredNative.add(body.nativeBody);
    }
    const worldBodies = Composite.allBodies(matterWorld).filter(
      b => !b.isSensor && !ignoredNative.has(b) && this.canCollideWith(b),
    );
    const otherCharacters = this.world.children
      .filter(
        (c): c is MatterCharacterControllerComponent => c instanceof MatterCharacterControllerComponent && c !== this,
      )
      .map(c => c.nativeBody)
      .filter(b => !ignoredNative.has(b) && this.canCollideWith(b));
    return worldBodies.concat(otherCharacters);
  }

  private canCollideWith(other: Body): boolean {
    return Detector.canCollide(this.nativeBody.collisionFilter, other.collisionFilter);
  }

  /** See this class's own doc for the sign convention this re-derives (`parentA`/`parentB`, not
   * calling-argument order). Returns a normal pointing away from the obstacle, towards this
   * character. */
  private normalTowardCharacter(collision: Collision): Point2 {
    const normal = Pnt2.clone(collision.normal);
    return collision.parentA === this.nativeBody ? normal : Pnt2.neg(normal);
  }

  private otherParent(collision: Collision): Body {
    return collision.parentA === this.nativeBody ? collision.parentB : collision.parentA;
  }

  private isWalkable(normal: Point2, up: Point2): boolean {
    return Pnt2.angle(normal, up) <= this.options.maxSlopeClimbAngleRad;
  }

  /**
   * Pushes this character's phantom body out of any obstacle it currently overlaps at `pos`, via
   * `Query.collides`, iterating a few times since resolving one contact can reveal/deepen another -
   * a discrete query like this one can start a tick already embedded (e.g. from a previous tick's
   * rounding/clamping). Must run before any marching this tick.
   */
  private recoverFromPenetration(pos: Point2, obstacles: Body[]): Point2 {
    let corrected = pos;
    for (let i = 0; i < 4; i++) {
      Body.setPosition(this.nativeBody, corrected);
      const collisions = Query.collides(this.nativeBody, obstacles);
      let worstDepth = 0;
      let worstNormal: Point2 | null = null;
      for (const collision of collisions) {
        if (collision.depth > worstDepth) {
          worstDepth = collision.depth;
          worstNormal = this.normalTowardCharacter(collision);
        }
      }
      if (!worstNormal) {
        break;
      }
      corrected = Pnt2.add(corrected, Pnt2.scalarMult(worstNormal, worstDepth));
    }
    return corrected;
  }

  /**
   * Marches this character's phantom body from `start` towards `start + delta` in small substeps
   * (see this class's own doc for why substepping is needed at all, in place of a true sweep), moving
   * the native body via `Body.setPosition` after every accepted substep, and stopping at the first
   * substep whose query finds an obstacle with a meaningful component opposing the direction of
   * travel. `overlappingBodies` in the result always reflects the query at wherever this call
   * finished (the fully-displaced position if never blocked, or the last-accepted position if it
   * was) - used by `move()` to find dynamic bodies to push.
   */
  private marchMove(start: Point2, delta: Point2, obstacles: Body[]): AxisMoveResult {
    const totalLen = Pnt2.len(delta);
    if (totalLen <= 1e-9) {
      Body.setPosition(this.nativeBody, start);
      return { pos: start, blocked: false, normal: null, overlappingBodies: [] };
    }
    const dir = Pnt2.scalarMult(delta, 1 / totalLen);
    const maxSubstep = Math.max(Math.min(this.radius, 0.1), 1e-3);
    const steps = Math.min(1024, Math.max(1, Math.ceil(totalLen / maxSubstep)));
    const stepLen = totalLen / steps;
    const stepVec = Pnt2.scalarMult(dir, stepLen);

    let pos = start;
    for (let i = 0; i < steps; i++) {
      const candidate = Pnt2.add(pos, stepVec);
      Body.setPosition(this.nativeBody, candidate);
      const collisions = Query.collides(this.nativeBody, obstacles);
      let blockingNormal: Point2 | null = null;
      let blockingDepth = 0;
      let blockingOpposition = 1e-4;
      const overlappingBodies: Body[] = [];
      for (const collision of collisions) {
        overlappingBodies.push(this.otherParent(collision));
        const normal = this.normalTowardCharacter(collision);
        const opposition = -Pnt2.dot(normal, dir);
        if (opposition > blockingOpposition) {
          blockingOpposition = opposition;
          blockingNormal = normal;
          blockingDepth = collision.depth;
        }
      }
      if (blockingNormal) {
        // Rather than simply reverting the whole (up to `maxSubstep`-long) substep - which would
        // only ever be as precise as the substep length itself, up to ~0.1 units short of the real
        // surface - push the phantom body back out of `candidate` along the blocking contact's own
        // normal by its exact overlap depth (the same technique `recoverFromPenetration` uses),
        // landing it right at the true contact surface regardless of substep granularity.
        // `this.options.offset` on top of that is the small skin gap `CharacterController2dOptions
        // .offset`'s own doc describes ("keep the underlying sweep test numerically stable") - without
        // it, this would land at *exactly* zero-gap contact, which is one bad floating-point rounding
        // away from a spurious re-penetration on the very next tick's query.
        const corrected = Pnt2.add(candidate, Pnt2.scalarMult(blockingNormal, blockingDepth + this.options.offset));
        Body.setPosition(this.nativeBody, corrected);
        return { pos: corrected, blocked: true, normal: blockingNormal, overlappingBodies };
      }
      pos = candidate;
    }
    return { pos, blocked: false, normal: null, overlappingBodies: [] };
  }

  /** Like `marchMove`, but always leaves the native body at `start` before returning - for a
   * speculative query (step-up assist, ground snap/landing checks) that must not commit any movement
   * unless the caller explicitly applies the returned position itself. */
  private probe(start: Point2, delta: Point2, obstacles: Body[]): AxisMoveResult {
    const result = this.marchMove(start, delta, obstacles);
    Body.setPosition(this.nativeBody, start);
    return result;
  }

  /**
   * If the horizontal leg was blocked, tries lifting the phantom body up by up to `maxStepHeight`,
   * retrying the same horizontal move at that height, and probing back down - only accepting the step
   * if it both clears more horizontal distance than the unraised attempt *and* actually lands on
   * walkable ground, not just a curved/vertical surface that happens to allow more clearance a hair
   * higher up (see the general `gg-engine-physics-adapter` skill's own caution on this exact
   * failure mode).
   *
   * **`minStepWidth` is not honored** - a step is accepted purely on `maxStepHeight`/walkability,
   * with no separate check for how much free space sits on top of the ledge. An attempt at that
   * check (probing forward from the landing spot by `minStepWidth` and requiring the ledge to still
   * be walkable there) was tried and reverted: this mover's own step-up sequence routinely *accepts*
   * a landing spot that is itself only a marginal, partial advance still snug against the same
   * obstacle corner that blocked the original horizontal move (`marchMove`'s substep-and-slide
   * approach, see this class's own doc, naturally creeps forward across several ticks rather than
   * clearing a corner in one) - a width probe from a landing spot like that immediately re-hits the
   * same corner and rejects the step outright, which stalls the character completely instead of
   * letting it creep across a perfectly normal ledge over the next few ticks. `minStepWidth` is
   * still accepted into this class's own options (see `CharacterController2dOptions.minStepWidth`'s
   * own doc: "not every backend can honor this exactly").
   */
  private applyStepAssist(
    start: Point2,
    initial: AxisMoveResult,
    horizontal: Point2,
    up: Point2,
    obstacles: Body[],
  ): Point2 {
    if (!initial.blocked || this.options.maxStepHeight <= 0) {
      Body.setPosition(this.nativeBody, initial.pos);
      return initial.pos;
    }
    const maxStep = this.options.maxStepHeight;
    const upProbe = this.probe(start, Pnt2.scalarMult(up, maxStep), obstacles);
    const raisedAmount = Pnt2.dot(Pnt2.sub(upProbe.pos, start), up);
    if (raisedAmount <= 1e-6) {
      Body.setPosition(this.nativeBody, initial.pos);
      return initial.pos;
    }
    const retryProbe = this.probe(upProbe.pos, horizontal, obstacles);
    const originalTravel = Pnt2.len(Pnt2.sub(initial.pos, start));
    const retryTravel = Pnt2.len(Pnt2.sub(retryProbe.pos, upProbe.pos));
    if (retryTravel <= originalTravel + 1e-6) {
      Body.setPosition(this.nativeBody, initial.pos);
      return initial.pos;
    }
    const landingProbe = this.probe(retryProbe.pos, Pnt2.scalarMult(up, -raisedAmount), obstacles);
    if (landingProbe.blocked && landingProbe.normal && this.isWalkable(landingProbe.normal, up)) {
      Body.setPosition(this.nativeBody, landingProbe.pos);
      return landingProbe.pos;
    }
    Body.setPosition(this.nativeBody, initial.pos);
    return initial.pos;
  }

  /**
   * Shoves a dynamic body the horizontal leg bumped into this tick - see
   * `CharacterController2dOptions.pushMass`'s doc for the formula (an inelastic collision against a
   * virtual mass moving at the character's own speed), applied here through
   * `MatterRigidBodyComponent.linearVelocity`'s existing getter/setter (which already carries the
   * conversion between matter-js's internal per-step velocity units and this engine's public m/s
   * units - see `MATTER_VELOCITY_SCALE`'s own doc) rather than touching `Body.velocity` directly.
   */
  private pushDynamicBodies(bodies: Body[], direction: Point2, horizLen: number, dt: number | undefined): void {
    const pushMass = this.options.pushMass;
    if (pushMass <= 0 || bodies.length === 0) {
      return;
    }
    if (!dt || dt <= 1e-9) {
      warnOnce(
        '[MatterCharacterControllerComponent] move() was called without `dt` while `pushMass` > 0 - ' +
          'skipping this dynamic-body push rather than approximating character speed from raw ' +
          'per-tick displacement (which would understate push force by roughly 1/dt). Pass the real ' +
          'tick delta (seconds) as the third argument to move() to enable pushing dynamic bodies.',
      );
      return;
    }
    const characterSpeed = horizLen / dt;
    const seen = new Set<number>();
    for (const nativeBody of bodies) {
      if (seen.has(nativeBody.id)) {
        continue;
      }
      seen.add(nativeBody.id);
      const comp = this.world.handleIdEntityMap.get(nativeBody.id);
      if (!(comp instanceof MatterRigidBodyComponent) || comp instanceof MatterTriggerComponent) {
        continue;
      }
      const bodyMass = comp.nativeBody.mass;
      if (!isFinite(bodyMass) || bodyMass <= 0) {
        continue;
      }
      const pushSpeed = characterSpeed * (pushMass / (pushMass + bodyMass));
      const v = comp.linearVelocity;
      const currentAlong = Pnt2.dot(v, direction);
      if (pushSpeed <= currentAlong) {
        continue;
      }
      const deltaSpeed = pushSpeed - currentAlong;
      comp.linearVelocity = Pnt2.add(v, Pnt2.scalarMult(direction, deltaSpeed));
    }
  }

  /**
   * Resolves `desiredTranslation` fully synchronously (see the interface's own doc) via
   * `recoverFromPenetration` + two axis-separated `marchMove` legs (horizontal, then vertical) +
   * a ground-snap probe - see this class's own doc for the overall approach and why each piece is
   * needed.
   */
  move(desiredTranslation: Point2, dt?: number): void {
    if (!this._added) {
      return;
    }
    const up = this._up;
    const obstacles = this.collectObstacles();

    let pos = this.recoverFromPenetration(this.position, obstacles);

    const vertical = Pnt2.scalarMult(up, Pnt2.dot(desiredTranslation, up));
    const horizontal = Pnt2.sub(desiredTranslation, vertical);
    const horizLen = Pnt2.len(horizontal);

    let pushBodies: Body[] = [];
    if (horizLen > 1e-9) {
      const initial = this.marchMove(pos, horizontal, obstacles);
      pushBodies = initial.overlappingBodies;
      pos = this.applyStepAssist(pos, initial, horizontal, up, obstacles);
    } else {
      Body.setPosition(this.nativeBody, pos);
    }

    // Moving strictly upward (a jump/rising through the air) must never be pulled back down by the
    // ground-snap fallback below - it exists to hug the ground while falling/standing still, not to
    // cancel out a deliberate upward move (this tick's own small rise is well within
    // `snapToGroundDistance` of the floor the character just left, otherwise every jump's takeoff
    // would be undone the very next tick - see the general `gg-engine-physics-adapter` skill's own
    // section on this pitfall).
    const movingUp = Pnt2.dot(vertical, up) > 1e-9;
    let grounded = false;
    let groundNormal: Point2 | null = null;

    const vertLen = Pnt2.len(vertical);
    if (vertLen > 1e-9) {
      const vStart = pos;
      const vResult = this.marchMove(pos, vertical, obstacles);
      pos = vResult.pos;
      if (vResult.blocked && vResult.normal) {
        if (!movingUp && this.isWalkable(vResult.normal, up)) {
          grounded = true;
          groundNormal = vResult.normal;
        } else {
          // Blocked by something that isn't walkable ground underfoot (a ceiling while ascending, or
          // a too-steep slope pressed straight into) - slide the remaining vertical distance along
          // the hit surface's tangent instead of leaving the character stuck jittering at the same
          // blocked point every tick.
          const travelledAlongUp = Pnt2.dot(Pnt2.sub(pos, vStart), up);
          const remainingAlongUp = Pnt2.dot(vertical, up) - travelledAlongUp;
          if (Math.abs(remainingAlongUp) > 1e-9) {
            const remaining = Pnt2.scalarMult(up, remainingAlongUp);
            const n = vResult.normal;
            const tangentRemaining = Pnt2.sub(remaining, Pnt2.scalarMult(n, Pnt2.dot(remaining, n)));
            if (Pnt2.len(tangentRemaining) > 1e-9) {
              const slideResult = this.marchMove(pos, tangentRemaining, obstacles);
              pos = slideResult.pos;
            }
          }
        }
      }
    } else {
      Body.setPosition(this.nativeBody, pos);
    }

    if (!grounded && !movingUp && this.options.snapToGroundDistance > 0) {
      const probeResult = this.probe(pos, Pnt2.scalarMult(up, -this.options.snapToGroundDistance), obstacles);
      if (probeResult.blocked && probeResult.normal && this.isWalkable(probeResult.normal, up)) {
        pos = probeResult.pos;
        grounded = true;
        groundNormal = probeResult.normal;
      }
    }

    Body.setPosition(this.nativeBody, pos);
    this._isGrounded = grounded;
    this._groundNormal = groundNormal;

    if (horizLen > 1e-9) {
      this.pushDynamicBodies(pushBodies, Pnt2.scalarMult(horizontal, 1 / horizLen), horizLen, dt);
    }
  }

  clone(): MatterCharacterControllerComponent {
    // Reads the CURRENT position/rotation, and the current `up`/`ownCollisionGroups`/
    // `interactWithCollisionGroups` - not whatever `this.options` was frozen to at construction
    // time. All five go stale the instant this component is added to a world and starts being
    // driven directly by `move()`/their own live setters (`this.options` itself is never touched
    // again after the constructor runs).
    return new MatterCharacterControllerComponent(
      this.world,
      {
        ...this.options,
        up: this.up,
        ownCollisionGroups: this.ownCollisionGroups,
        interactWithCollisionGroups: this.interactWithCollisionGroups,
      },
      {
        position: this.position,
        rotation: this.rotation,
      },
    );
  }

  addToWorld(world: MatterGgWorld): void {
    if (world.physicsWorld != this.world) {
      throw new Error('Matter bodies cannot be shared between different worlds');
    }
    this._added = true;
    this.world.added$.next(this);
  }

  removeFromWorld(world: MatterGgWorld, dispose: boolean = false): void {
    if (world.physicsWorld != this.world) {
      throw new Error('Matter bodies cannot be shared between different worlds');
    }
    this._added = false;
    this.world.removed$.next(this);
    if (dispose) {
      this.dispose();
    }
  }

  // Like `MatterRigidBodyComponent.dispose()`, this phantom body is a plain, GC-managed JS object
  // that was never added to `Composite`/`engine.world` at all - there is no native handle to free and
  // no RxJS subject of its own to complete (unlike a rigid body/trigger, this interface exposes no
  // collision-event stream).
  dispose(): void {
    // nothing to free
  }
}
