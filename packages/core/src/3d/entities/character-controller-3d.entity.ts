import { Pnt3, Point3, Point4, Qtrn, TickOrder } from '../../base';
import { Gg3dWorld, Gg3dWorldTypeDocRepo } from '../gg-3d-world';
import { IRenderable3dEntity } from './i-renderable-3d.entity';
import { IPositionable3d } from '../interfaces/i-positionable-3d';
import { CharacterController3dOptions } from '../models/character-controller-options';

/**
 * Options for a `CharacterController3dEntity`: the capsule shape/mover tuning from
 * `CharacterController3dOptions`, plus the gameplay tuning (speed, jump, gravity) this entity owns
 * itself so behavior stays identical across physics backends - see the class doc.
 */
export type CharacterController3dEntityOptions = CharacterController3dOptions & {
  /** Walking speed, in m/s. Default 4. */
  walkSpeed: number;
  /** Multiplier applied to `walkSpeed` while `isRunning`. Default 1.8. */
  runSpeedMultiplier: number;
  /** Multiplier applied to `walkSpeed` while `isCrouching`. Default 0.5. */
  crouchSpeedMultiplier: number;
  /** Capsule `centersDistance` used while `isCrouching`. Must be smaller than `centersDistance`. */
  crouchCentersDistance: number;
  /**
   * Not consumed by this class - carried here purely so an input driver (e.g.
   * `PlayerCharacterController`) can read the crouch key behavior from the same options object
   * used to configure the character itself. `'hold'`: crouch while the key is held, stand up on
   * release (subject to the headroom check above). `'toggle'`: each press flips `isCrouching`.
   * Default `'hold'`.
   */
  crouchMode: 'hold' | 'toggle';
  /** Takeoff vertical speed applied by `jump()`, in m/s, launched along `up` opposing gravity. Default 5. */
  jumpSpeed: number;
  /**
   * Downward acceleration integrated while airborne, in m/s², straight along `up` (no horizontal
   * component), **overriding** the world's own `physicsWorld.gravity` for this character. Leave
   * `undefined` (the default) to instead track `physicsWorld.gravity` live every tick, full vector
   * - direction, magnitude, *and* any horizontal component - exactly like it would affect a dynamic
   * rigid body (including live changes via the `gravity` dev-console command). A tilted/non-vertical
   * `physicsWorld.gravity` therefore drags this character sideways while airborne or sliding down a
   * too-steep surface, not just downward - see `CharacterController3dEntity`'s class doc. This
   * character's underlying `characterController` is always a kinematic mover unaffected by the
   * physics engine's own gravity integration (see `ICharacterController3dComponent`'s doc), which is
   * why this entity must read and apply gravity itself rather than relying on the backend to do it -
   * only set this to a number when a character deliberately needs a gravity scale different from the
   * rest of the world (e.g. floatier low-gravity player); a numeric override is always straight down
   * along `up`, with no horizontal drag.
   */
  gravity: number | undefined;
  /**
   * How fast horizontal movement can be *steered* while airborne, as a fraction of the current
   * walk/run speed applied per second of acceleration (0..1) - **not** a flat multiplier on speed
   * itself. The horizontal velocity in effect at the moment of leaving the ground (walk or run) is
   * carried through the whole jump/fall arc unchanged as long as `moveDirection`/`isRunning` don't
   * change; this only caps how quickly that carried velocity can be redirected towards a *new*
   * desired direction/speed once airborne (see `updateMovement`'s doc). Default 0.3.
   */
  airControlFactor: number;
};

const DEFAULT_OPTIONS: Required<
  Omit<CharacterController3dEntityOptions, 'radius' | 'centersDistance' | 'crouchCentersDistance'>
> = {
  offset: 0.01,
  maxStepHeight: 0.3,
  minStepWidth: 0.2,
  maxSlopeClimbAngleRad: (50 * Math.PI) / 180,
  snapToGroundDistance: 0.3,
  up: Pnt3.Z,
  ownCollisionGroups: 'all',
  interactWithCollisionGroups: 'all',
  pushMass: 80,
  walkSpeed: 4,
  runSpeedMultiplier: 1.8,
  crouchSpeedMultiplier: 0.5,
  crouchMode: 'hold',
  jumpSpeed: 5,
  gravity: undefined,
  airControlFactor: 0.3,
};

/**
 * A capsule-bodied, physics-driven character entity: walk/run/crouch/jump gameplay logic that
 * works identically on top of any physics backend implementing `ICharacterController3dComponent`
 * (see that interface's doc for why - all of gravity/jump/speed integration happens here, not in
 * the backend-specific component). Reusable for the player (see `PlayerCharacterController`, which
 * adds keyboard/mouse input and a camera on top of this) or for an NPC driven by AI logic instead.
 *
 * Gravity is integrated as a full 3D vector (`gravityVector`/`_fallVelocity`), not just its
 * component along `up`: a tilted `physicsWorld.gravity` drags the character sideways while airborne,
 * and standing on a surface steeper than `maxSlopeClimbAngleRad` (re-checked here every tick via
 * `isWalkableGround`, regardless of what an adapter's own `isGrounded` reports) is treated as not
 * stably grounded, so the character slides/falls down it under gravity instead of clinging to it -
 * see `updateMovement`'s doc for the exact resting-vs-falling rule. Getting blocked from above while
 * ascending (e.g. jumping into a ceiling) is handled the same way as landing: `updateMovement`
 * compares the actual post-`move()` displacement against the desired one along `up` and, if capped,
 * immediately cancels `_fallVelocity`'s upward component - otherwise it would keep decelerating on
 * gravity's own time schedule regardless of the character's actual (blocked) position, making the
 * character look glued to the ceiling for as long as an unobstructed jump's rise phase would have
 * taken.
 *
 * Horizontal movement is direct/instantaneous while resting on the ground (no momentum - snappy,
 * input-follows-exactly control), but becomes velocity-based the instant the character leaves the
 * ground: whatever horizontal ground speed was in effect at takeoff (walk or run) is captured into
 * `_airHorizontalVelocity` and persists through the whole arc unless the input driver changes
 * `moveDirection`/`isRunning`, in which case `airControlFactor` caps how fast the resulting steering
 * can redirect it (see `updateMovement`'s doc) - so a running jump travels exactly as far
 * horizontally as the run speed implies, instead of the speed silently collapsing to a fraction of
 * it the instant the character leaves the ground.
 *
 * `moveDirection` is local-space (rotated by `this.rotation` internally): local +Y is "forward" at
 * zero yaw, local +X is "right" at zero yaw, local Z is unused (always ignored - vertical motion is
 * handled separately, see above) - the same right=X/forward=Y/up=Z axis paradigm
 * `RaycastVehicle3dEntity`/`GgCarEntity` use (see e.g. `AmmoRaycastVehicleComponent`'s
 * `setCoordinateSystem(0, 2, 1)`), **not** the camera/`FreeCameraController` convention (local -Z
 * forward, local Y up) - that convention matches a camera's rest orientation (forward down local
 * -Z), whereas this entity's rest/identity orientation stands with its capsule's long axis along
 * local Z (`up`), so `this.rotation` must only ever be a plain rotation around `up` (e.g.
 * `Qtrn.fromAngle(up, yaw)`) for the capsule to stay upright - never a camera-style look-at basis
 * change. A driver (e.g. `PlayerCharacterController`) must map input to `moveDirection` and compute
 * `this.rotation` using this same convention (note `Pnt3.toSpherical`/`fromSpherical`'s own `theta`
 * is measured from +X, not +Y - converting a look-direction angle into this entity's yaw needs a
 * -90° offset, see `PlayerCharacterController.updateCamera`'s comment for the derivation).
 */
export class CharacterController3dEntity<TypeDoc extends Gg3dWorldTypeDocRepo = Gg3dWorldTypeDocRepo>
  extends IRenderable3dEntity<TypeDoc>
  implements IPositionable3d
{
  public readonly tickOrder = TickOrder.PHYSICS_SIMULATION - 5;

  public readonly options: Required<CharacterController3dEntityOptions>;

  /** Local-space desired move direction (XY plane, "+Y forward / +X right", Z unused); set by an input driver - see this class's doc. */
  public moveDirection: Point3 = Pnt3.O;
  /** Whether to move at `walkSpeed * runSpeedMultiplier`. Ignored while `isCrouching`. */
  public isRunning: boolean = false;

  private _isCrouching: boolean = false;
  private _wantsToStand: boolean = false;
  /** Full 3D velocity accumulated from gravity (and jump takeoff) while not stably resting on a
   * walkable surface - see `updateMovement`'s doc for why this is a full vector, not just a scalar
   * along `up`. */
  private _fallVelocity: Point3 = Pnt3.O;
  /** Horizontal velocity carried while airborne - seeded from the ground speed in effect at the
   * moment of leaving the ground (jumping or walking off an edge) so that speed persists through
   * the whole arc, then only ever adjusted by limited air-control steering - see `updateMovement`'s
   * doc for why this is tracked separately from `_fallVelocity` (which integrates gravity, not
   * player input). Always `Pnt3.O` while resting on the ground, where movement is direct instead. */
  private _airHorizontalVelocity: Point3 = Pnt3.O;
  /** Whether the previous `updateMovement` tick was stably resting on the ground - used to detect
   * the exact tick horizontal movement transitions from direct ground control to airborne momentum,
   * so `_airHorizontalVelocity` is seeded exactly once per takeoff rather than ramping up from zero
   * under `airControlFactor` (see `updateMovement`'s doc). */
  private _wasResting: boolean = true;
  /** Set by `jump()`; tells a genuine jump apart from an ordinary landing, without relying on
   * fragile sign comparisons against a possibly-zero `gravityAlongUp` (see `updateMovement`).
   * Consumed/cleared the first `updateMovement` tick that observes `!restingOnGround` (the adapter
   * genuinely agrees the character has left the ground) - **not** unconditionally after exactly one
   * tick. A single-tick exemption is not always enough: some adapters' native grounded flag (e.g.
   * Rapier's `computedGrounded()`) keeps reporting grounded for a few ticks after takeoff when the
   * per-tick rise is small (high frame rate / small `dt`), independent of the actual sweep result -
   * trusting it immediately would zero the jump's own velocity before the character ever climbs far
   * enough to clear that native threshold, snapping it straight back down via the adapter's own
   * ground-snapping the very next tick (see `gg-engine-physics-adapter-rapier`'s "two separate
   * native features silently cancel a jump" pitfall for the concrete mechanism). Staying exempt
   * every tick where `restingOnGround` is still (incorrectly) true keeps `_fallVelocity` untouched
   * (neither zeroed nor decayed - see the `grounded`/`restingOnGround` branches below) rather than
   * cancelling the takeoff, so the character keeps rising tick after tick until the adapter's own
   * flag catches up with reality - this self-resolves in one extra tick at typical frame rates and
   * only a handful at very high ones, without needing a fixed tick count or time-based timeout. */
  private _justJumped: boolean = false;

  public get isCrouching(): boolean {
    return this._isCrouching;
  }

  /**
   * Crouching down always succeeds immediately. Standing back up first raycasts straight up for
   * the extra height needed and only actually stands once that space is clear - if blocked, the
   * request is remembered (`_wantsToStand`) and retried every tick until it succeeds, so the
   * character never pops through a ceiling. The check itself only ever runs while grounded (see
   * `tryStandUp`'s own doc for why an airborne position isn't safe to check at all) - releasing
   * crouch mid-air (e.g. having jumped while already crouched) just defers the first attempt to the
   * moment of landing, same as being blocked defers every retry after that.
   */
  public set isCrouching(value: boolean) {
    if (value) {
      this._wantsToStand = false;
      if (!this._isCrouching) {
        this._isCrouching = true;
        this.recreateCapsule(this.options.crouchCentersDistance);
      }
    } else {
      this._wantsToStand = true;
      if (this.isGrounded) {
        this.tryStandUp();
      }
    }
  }

  public get isGrounded(): boolean {
    return this.characterController.isGrounded;
  }

  public get groundNormal(): Point3 | null {
    return this.characterController.groundNormal;
  }

  public object3D: TypeDoc['vTypeDoc']['displayObject'] | null;
  public characterController: TypeDoc['pTypeDoc']['characterController'];

  private _position: Point3 = Pnt3.O;
  public get position(): Point3 {
    return this._position;
  }

  public set position(value: Point3) {
    this.characterController.position = value;
    if (this.object3D) {
      this.object3D.position = value;
    }
    this._position = value;
  }

  private _rotation: Point4 = Qtrn.O;
  public get rotation(): Point4 {
    return this._rotation;
  }

  public set rotation(value: Point4) {
    this.characterController.rotation = value;
    if (this.object3D) {
      this.object3D.rotation = value;
    }
    this._rotation = value;
  }

  private _hideMesh: boolean = false;
  /** When `true`, the mesh is hidden regardless of `visible`/`worldVisible` - used by
   * `PlayerCharacterController` to hide the character's own body in first-person view. */
  public get hideMesh(): boolean {
    return this._hideMesh;
  }

  public set hideMesh(value: boolean) {
    this._hideMesh = value;
    this.updateVisibility();
  }

  public updateVisibility(): void {
    if (this.object3D) {
      this.object3D.visible = this.worldVisible && !this._hideMesh;
    }
    super.updateVisibility();
  }

  constructor(
    options: Partial<CharacterController3dEntityOptions> &
      Pick<CharacterController3dEntityOptions, 'radius' | 'centersDistance'>,
    object3D: TypeDoc['vTypeDoc']['displayObject'] | null,
    characterController: TypeDoc['pTypeDoc']['characterController'],
  ) {
    super();
    this.options = {
      ...DEFAULT_OPTIONS,
      crouchCentersDistance: options.centersDistance * 0.6,
      ...options,
    };
    this.object3D = object3D;
    this.characterController = characterController;
    if (characterController.name) {
      this.name = characterController.name;
    }
    this.addComponents(characterController);
    if (object3D) {
      this.addComponents(object3D);
    }
    this._position = characterController.position;
    this._rotation = characterController.rotation;
  }

  onSpawned(world: Gg3dWorld<TypeDoc>) {
    super.onSpawned(world);
    this.tick$.subscribe(([_, delta]) => this.updateMovement(delta));
  }

  /**
   * This character's current gravitational acceleration as a full 3D vector - **not** just its
   * component along `up`. Uses `options.gravity` (interpreted as a downward magnitude straight
   * along `up`, no horizontal component) when explicitly set; otherwise tracks
   * `physicsWorld.gravity` live, direction and magnitude alike - including any horizontal
   * component, so a tilted/non-vertical world gravity vector actually drags the character sideways
   * instead of only affecting its fall speed (a kinematic character controller gets no gravity from
   * the physics engine for free - see `gravity`'s own doc on `CharacterController3dEntityOptions`
   * for why this entity must read and integrate it itself).
   */
  private get gravityVector(): Point3 {
    if (this.options.gravity !== undefined) {
      return Pnt3.scalarMult(this.characterController.up, -this.options.gravity);
    }
    return this.world?.physicsWorld?.gravity ?? Pnt3.O;
  }

  /**
   * `gravityVector`'s own component along `up` (positive = accelerating upward) - the part of
   * gravity that presses the character into/away from the ground it's standing on, and the part
   * `jump()` launches directly against. See `gravityVector`'s doc for the horizontal component this
   * deliberately excludes.
   */
  private get gravityAlongUp(): number {
    return Pnt3.dot(this.gravityVector, this.characterController.up);
  }

  /**
   * Whether the current `groundNormal` is shallow enough to walk on, per `maxSlopeClimbAngleRad`.
   * `false` while airborne (`groundNormal` is `null` then). This is re-checked here at the entity
   * level - on top of whatever slope handling an adapter's own `move()` already does internally -
   * so a character resting against a normal steeper than the configured limit (e.g. balanced right
   * at the silhouette edge of a curved surface like a sphere or cylinder, where the contact normal
   * can be far steeper than the surface looks from a distance) is never treated as stably grounded
   * regardless of adapter, and instead slides per `updateMovement`'s gravity integration below.
   */
  private get isWalkableGround(): boolean {
    const normal = this.groundNormal;
    return normal !== null && Pnt3.angle(normal, this.characterController.up) <= this.options.maxSlopeClimbAngleRad;
  }

  /**
   * Triggers a jump (a takeoff velocity away from the ground, opposing gravity) only while stably
   * grounded - the same `isGrounded && isWalkableGround` condition `updateMovement` uses to decide
   * resting-vs-falling (see its doc), not just the adapter's raw `isGrounded` alone. Otherwise a
   * character balanced on a too-steep surface (`isGrounded === true` but sliding, per
   * `isWalkableGround`) could jump off it as if it were stable footing. A no-op mid-air, and a
   * no-op while grounded on an unwalkably steep surface.
   */
  public jump(): void {
    if (this.isGrounded && this.isWalkableGround) {
      const up = this.characterController.up;
      // launch opposite whichever way gravity currently pulls (normally "up"), so this still does
      // the right thing under an inverted/overridden gravity vector; with no gravity at all
      // (exactly 0), default to "up" like the ordinary case, rather than flipping on the `0`/`-0`
      // sign edge case
      const direction = this.gravityAlongUp > 0 ? -1 : 1;
      // replace only the along-`up` component of the current fall velocity, preserving any
      // horizontal drift accumulated from a tangential gravity pull (e.g. sliding off a steep
      // slope) - a jump shouldn't cancel sideways momentum, just add vertical takeoff speed
      const currentAlongUp = Pnt3.dot(this._fallVelocity, up);
      this._fallVelocity = Pnt3.add(
        this._fallVelocity,
        Pnt3.scalarMult(up, direction * this.options.jumpSpeed - currentAlongUp),
      );
      this._justJumped = true;
    }
  }

  private updateMovement(deltaMs: number): void {
    const dt = deltaMs / 1000;
    const up = this.characterController.up;
    const gravityVector = this.gravityVector;
    const gravityAlongUp = Pnt3.dot(gravityVector, up);
    // Being `isGrounded` only actually holds the character in place while (a) gravity still presses
    // it into the surface underfoot (`gravityAlongUp <= 0` against a floor below - if gravity is
    // overridden/changed live, e.g. via the `gravity` dev-console command, to instead pull *away*
    // from that surface, the ground can no longer hold the character there), and (b) the surface is
    // shallow enough to stand on (`isWalkableGround` - see its doc for why this is re-checked here
    // rather than trusted from the adapter alone). Anything else is treated like being airborne:
    // free to accelerate away/downhill, rather than getting stuck floating or clinging to a surface
    // too steep to actually stand on, which naively gating on the raw `isGrounded` flag alone would
    // do.
    const restingOnGround = this.isGrounded && this.isWalkableGround && gravityAlongUp <= 0;
    // A jump takeoff is exempted from counting as "grounded" here (tracked via `_justJumped` rather
    // than a sign comparison against `gravityAlongUp`, which breaks when it's exactly `0`), even
    // though `restingOnGround` itself may still read true this tick (and for a few ticks after,
    // rather than just the takeoff one - see `_justJumped`'s own doc for why the exemption isn't
    // dropped until `restingOnGround` genuinely reads false) - so every such tick is treated as
    // airborne for both fall-velocity and horizontal-momentum purposes below.
    const grounded = restingOnGround && !this._justJumped;

    if (grounded) {
      // fully arrest fall velocity - both the settling/landing speed along `up` and any horizontal
      // drift accumulated from gravity's tangential pull while airborne or sliding - once resting
      // stably; contact + friction with a walkable surface cancels both.
      this._fallVelocity = Pnt3.O;
    } else if (!restingOnGround) {
      this._fallVelocity = Pnt3.add(this._fallVelocity, Pnt3.scalarMult(gravityVector, dt));
      // The adapter itself now agrees the character has actually left the ground - the exemption
      // has served its purpose (see `_justJumped`'s doc); ordinary landing detection resumes from
      // the next tick. Deliberately *not* cleared while `restingOnGround` is still true (even though
      // `grounded` is false here too, via `!this._justJumped`), since that's exactly the stale-flag
      // window the exemption exists to bridge.
      this._justJumped = false;
    }

    let speed = this.options.walkSpeed;
    if (this._isCrouching) {
      speed *= this.options.crouchSpeedMultiplier;
    } else if (this.isRunning) {
      speed *= this.options.runSpeedMultiplier;
    }

    const localHoriz = Pnt3.norm({ x: this.moveDirection.x, y: this.moveDirection.y, z: 0 });
    const desiredHoriz = Pnt3.rot(Pnt3.scalarMult(localHoriz, speed), this.rotation);

    let horizontalVelocity: Point3;
    if (grounded) {
      // Direct control: no momentum needed, movement follows input/speed exactly, every tick.
      this._airHorizontalVelocity = Pnt3.O;
      horizontalVelocity = desiredHoriz;
    } else if (this._wasResting) {
      // The exact tick of leaving the ground (jumping or walking off an edge): seed the carried
      // velocity with whatever ground speed (walk or run) was in effect *this* tick, so a running
      // takeoff keeps its running speed for the whole arc, rather than starting the flight at zero
      // and re-approaching it at the deliberately slow `airControlFactor` rate below.
      this._airHorizontalVelocity = desiredHoriz;
      horizontalVelocity = desiredHoriz;
    } else {
      // Continuing airborne: steer the *existing* carried velocity towards the current desired
      // direction/speed at a capped acceleration (`airControlFactor` fraction of that speed, per
      // second) instead of overriding it outright - holding the same input preserves momentum
      // exactly (delta is ~0, so the cap never engages), while changing input (releasing run,
      // turning) redirects it gradually rather than snapping.
      const delta = Pnt3.sub(desiredHoriz, this._airHorizontalVelocity);
      const deltaLen = Pnt3.len(delta);
      const maxDelta = this.options.airControlFactor * speed * dt;
      this._airHorizontalVelocity =
        deltaLen <= maxDelta
          ? desiredHoriz
          : Pnt3.add(this._airHorizontalVelocity, Pnt3.scalarMult(delta, maxDelta / deltaLen));
      horizontalVelocity = this._airHorizontalVelocity;
    }
    this._wasResting = grounded;

    const desiredTranslation = Pnt3.add(
      Pnt3.scalarMult(horizontalVelocity, dt),
      Pnt3.scalarMult(this._fallVelocity, dt),
    );

    const previousPosition = this._position;
    this.characterController.move(desiredTranslation, dt);

    // Sync the cached position/rotation from this tick's `move()` result *before* tryStandUp()/
    // recreateCapsule() below - both read `this.position`/`this.rotation` (the cached getters, not
    // the characterController directly) to place a raycast origin / the replacement capsule, and
    // must see this tick's fresh result rather than last tick's stale cache.
    this._position = this.characterController.position;
    this._rotation = this.characterController.rotation;
    if (this.object3D) {
      this.object3D.position = this._position;
      this.object3D.rotation = this._rotation;
    }

    // Detect being blocked from above (e.g. jumping into a ceiling) while airborne and ascending.
    // `move()` resolves the collision by capping the actual displacement, but
    // `ICharacterController3dComponent` has no "here's what you hit" signal back to this entity
    // (see its doc) - only the resulting position. Without this check, `_fallVelocity`'s upward
    // component keeps decelerating purely on gravity's own time schedule every tick regardless of
    // whether the character actually moved, exactly as it would in free flight - so a jump
    // interrupted by a ceiling would visibly stick to it for as long as an unobstructed jump's rise
    // phase takes to peak, then fall for as long as an unobstructed jump's fall phase takes,
    // instead of immediately falling back once blocked. Comparing actual vs desired displacement
    // along `up` catches the block and cancels the upward component of `_fallVelocity` right away,
    // like an inelastic collision against the ceiling - gravity then takes over from zero speed
    // instead of coasting down an imaginary, uninterrupted arc.
    if (!grounded) {
      const fallAlongUp = Pnt3.dot(this._fallVelocity, up);
      const desiredUp = Pnt3.dot(desiredTranslation, up);
      if (fallAlongUp > 0 && desiredUp > 0) {
        const actualUp = Pnt3.dot(Pnt3.sub(this._position, previousPosition), up);
        const tolerance = Math.max(this.options.offset, 1e-4);
        if (actualUp < desiredUp - tolerance) {
          this._fallVelocity = Pnt3.sub(this._fallVelocity, Pnt3.scalarMult(up, fallAlongUp));
        }
      }
    }

    // Only ever attempt the headroom check while actually resting on something (see `tryStandUp`'s
    // own doc for why airborne is unsafe to check at all, not just unnecessary) - it retries again
    // automatically the moment `isGrounded` goes back to `true` (landing, or never having left),
    // per `_wantsToStand`'s own "retried every tick until it succeeds" contract, so a jump taken
    // while crouched and blocked from standing simply defers the retry until it lands rather than
    // ever skipping it outright.
    if (this._wantsToStand && this.isGrounded) {
      this.tryStandUp();
    }
  }

  /**
   * Raycasts straight up from the current (crouched) capsule's top by the extra height standing
   * would need. The ray starts a hair above that top point along `up` - the capsule's own outward
   * surface normal at that exact point - so it originates just outside the character's own shape
   * and can never register a self-hit, with no collision-group bookkeeping required.
   *
   * Only ever called while `isGrounded` (see the `updateMovement` call site) - **not** merely as an
   * optimization. A thin ray probe like this one needs *some* endpoint to start from a point known
   * to be outside every other body, and the only such point this class can derive without a real
   * shape-overlap query (which `IPhysicsWorld3dComponent` doesn't expose) is "just outside my own
   * capsule" - which only actually holds when the capsule is at rest. While actively rising through
   * a jump, the capsule's own top can end up, on some single tick, closer to a low ceiling than that
   * same tiny margin - not yet blocked by `move()`'s own sweep (which stops it correctly the very
   * next tick), but *already* close enough that this ray's start point lands inside the ceiling
   * anyway, and a ray beginning inside a shape never registers an entry hit against it (the same
   * false-negative failure mode as `AmmoCharacterControllerComponent`'s embedded-landing-position
   * pitfall - see `gg-engine-physics-adapter-ammo` - except this version needs no collision at all,
   * just a close enough natural approach on a single tick, so it isn't fixed by keeping landing
   * positions clean). Regression, found jumping while crouched under a ceiling too low to stand
   * under: on the one tick the rising capsule's top passed within this margin of the ceiling but
   * hadn't yet been blocked by it, the headroom check read "clear" and stood the character up,
   * permanently (nothing re-checks once `_isCrouching` is already `false`), clipping the now-tall
   * capsule into the ceiling for the rest of the jump. Swapping the ray's own two endpoints doesn't
   * generally fix this either - a sufficiently thick ceiling can just as easily embed *that* end
   * instead (confirmed empirically) - so the fix is to never run this check against a position that
   * might still be mid-flight in the first place.
   */
  private tryStandUp(): void {
    if (!this._isCrouching || !this.world?.physicsWorld) {
      return;
    }
    const heightDiff = this.options.centersDistance - this.options.crouchCentersDistance;
    if (heightDiff <= 0) {
      this._isCrouching = false;
      this._wantsToStand = false;
      return;
    }
    const up = this.characterController.up;
    const skin = Math.max(this.options.offset * 2, 0.02);
    const currentTop = Pnt3.add(
      this.position,
      Pnt3.scalarMult(up, this.characterController.radius + this.options.crouchCentersDistance / 2),
    );
    const from = Pnt3.add(currentTop, Pnt3.scalarMult(up, skin));
    const to = Pnt3.add(currentTop, Pnt3.scalarMult(up, heightDiff));
    const result = this.world.physicsWorld.raycast({ from, to });
    if (!result.hasHit) {
      this._isCrouching = false;
      this._wantsToStand = false;
      this.recreateCapsule(this.options.centersDistance);
    }
    // otherwise: stays crouched, will retry next tick (see updateMovement)
  }

  /**
   * Swaps the underlying `characterController` component for a freshly-created one at a different
   * `centersDistance`, keeping the character's feet planted in place. Used for crouch/stand
   * transitions instead of resizing a component in place - see `ICharacterController3dComponent`'s
   * doc for why.
   */
  private recreateCapsule(newCentersDistance: number): void {
    if (!this.world?.physicsWorld) {
      // not spawned yet; nothing to recreate against
      return;
    }
    const old = this.characterController;
    const up = old.up;
    const feetPoint = Pnt3.sub(this.position, Pnt3.scalarMult(up, old.radius + old.centersDistance / 2));
    const newPosition = Pnt3.add(feetPoint, Pnt3.scalarMult(up, old.radius + newCentersDistance / 2));

    const created = this.world.physicsWorld.factory.createCharacterController(
      {
        radius: this.options.radius,
        centersDistance: newCentersDistance,
        offset: this.options.offset,
        maxStepHeight: this.options.maxStepHeight,
        minStepWidth: this.options.minStepWidth,
        maxSlopeClimbAngleRad: this.options.maxSlopeClimbAngleRad,
        snapToGroundDistance: this.options.snapToGroundDistance,
        up,
        ownCollisionGroups: old.ownCollisionGroups,
        interactWithCollisionGroups: old.interactWithCollisionGroups,
      },
      { position: newPosition, rotation: this.rotation },
    );
    // Carry over `ignoredBodies` (e.g. a currently-held `Grabbable3dEntity`'s objectBody - see
    // `ICharacterController3dComponent.ignoredBodies`'s doc) - `created` starts with an empty set of
    // its own, and this is a wholesale component swap, not a mutation of `old` in place, so nothing
    // else does this automatically. Without it, crouching or standing up while holding something
    // would silently drop the exclusion, making the held object collide with its own holder again
    // from that tick on despite `grab()` never having been told anything changed.
    for (const ignored of old.ignoredBodies) {
      created.ignoredBodies.add(ignored);
    }

    // `dispose: true` here is load-bearing, not decoration: `old` is dropped entirely right after
    // this call (no other reference survives), so freeing its native capsule shape/ghost object can
    // only happen inside this `removeFromWorld(world, true)` call - see
    // `ICharacterController3dComponent`'s doc (and `IWorldComponent.removeFromWorld`'s, which states
    // the general contract) for what an adapter's override must do with `dispose`. TODO: at least
    // one adapter (Ammo, `AmmoCharacterControllerComponent.removeFromWorld`) currently ignores this
    // flag and leaks the old capsule/ghost object on every crouch/stand transition - fix pending,
    // tracked per-adapter (see `gg-engine-physics-adapter`'s "The `removeFromWorld(dispose)`
    // contract" section).
    this.removeComponents([old], true);
    this.characterController = created;
    this.addComponents(created);
    this._position = created.position;
    this._rotation = created.rotation;
    if (this.object3D) {
      this.object3D.position = this._position;
      this.object3D.rotation = this._rotation;
    }
  }
}
