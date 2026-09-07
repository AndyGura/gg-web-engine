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
  /** Horizontal move-speed multiplier applied while airborne (0..1). Default 0.3. */
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
 * see `updateMovement`'s doc for the exact resting-vs-falling rule.
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
  /** Set by `jump()`, consumed and cleared by the very next `updateMovement` tick - lets that tick
   * tell a genuine same-frame jump apart from an ordinary landing, without relying on fragile sign
   * comparisons against a possibly-zero `gravityAlongUp` (see `updateMovement`). */
  private _justJumped: boolean = false;

  public get isCrouching(): boolean {
    return this._isCrouching;
  }

  /**
   * Crouching down always succeeds immediately. Standing back up first raycasts straight up for
   * the extra height needed and only actually stands once that space is clear - if blocked, the
   * request is remembered (`_wantsToStand`) and retried every tick until it succeeds, so the
   * character never pops through a ceiling.
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
      this.tryStandUp();
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
    this.name = characterController.name;
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

  /** Triggers a jump (a takeoff velocity away from the ground, opposing gravity) only while grounded; a no-op mid-air. */
  public jump(): void {
    if (this.isGrounded) {
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

    if (restingOnGround && !this._justJumped) {
      // fully arrest fall velocity - both the settling/landing speed along `up` and any horizontal
      // drift accumulated from gravity's tangential pull while airborne or sliding - once resting
      // stably; contact + friction with a walkable surface cancels both. A same-tick jump (tracked
      // via `_justJumped` rather than a sign comparison, which breaks when `gravityAlongUp` is
      // exactly `0`) is exempted so it isn't immediately clobbered before the character has had a
      // chance to actually leave the ground.
      this._fallVelocity = Pnt3.O;
    } else if (!restingOnGround) {
      this._fallVelocity = Pnt3.add(this._fallVelocity, Pnt3.scalarMult(gravityVector, dt));
    }
    this._justJumped = false;

    let speed = this.options.walkSpeed;
    if (this._isCrouching) {
      speed *= this.options.crouchSpeedMultiplier;
    } else if (this.isRunning) {
      speed *= this.options.runSpeedMultiplier;
    }
    if (!restingOnGround) {
      speed *= this.options.airControlFactor;
    }

    const localHoriz = Pnt3.norm({ x: this.moveDirection.x, y: this.moveDirection.y, z: 0 });
    const worldHoriz = Pnt3.rot(Pnt3.scalarMult(localHoriz, speed), this.rotation);
    const desiredTranslation = Pnt3.add(Pnt3.scalarMult(worldHoriz, dt), Pnt3.scalarMult(this._fallVelocity, dt));

    this.characterController.move(desiredTranslation, dt);

    if (this._wantsToStand) {
      this.tryStandUp();
    }

    this._position = this.characterController.position;
    this._rotation = this.characterController.rotation;
    if (this.object3D) {
      this.object3D.position = this._position;
      this.object3D.rotation = this._rotation;
    }
  }

  /**
   * Raycasts straight up from the current (crouched) capsule's top by the extra height standing
   * would need. The ray starts a hair above that top point along `up` - the capsule's own outward
   * surface normal at that exact point - so it originates just outside the character's own shape
   * and can never register a self-hit, with no collision-group bookkeeping required.
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
