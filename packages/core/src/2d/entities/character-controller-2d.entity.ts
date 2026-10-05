import {
  INetworkInputDriven,
  INetworkSyncable,
  ISerializableEntity,
  MoverCorrection,
  MoverNetState,
  CorrectionOutcome,
  NetworkApplyContext,
  Pnt2,
  Point2,
  TickOrder,
} from '../../base';
import { isMaterialReadable2d } from '../components/rendering/i-material-readable-2d.component';
import { Gg2dWorld, Gg2dWorldTypeDocRepo } from '../gg-2d-world';
import { IRenderable2dEntity } from './i-renderable-2d.entity';
import { IPositionable2d } from '../interfaces/i-positionable-2d';
import { CharacterController2dOptions } from '../models/character-controller-options';
import { takeUntil } from 'rxjs';

/**
 * Options for a `CharacterController2dEntity`: the capsule shape/mover tuning from
 * `CharacterController2dOptions`, plus the gameplay tuning (speed, jump, crouch, gravity) this
 * entity owns itself so behavior stays identical across physics backends - see the class doc.
 * Mirrors `CharacterController3dEntityOptions` field-for-field.
 */
export type CharacterController2dEntityOptions = CharacterController2dOptions & {
  /** Walking speed, in world units/s. Default 4. */
  walkSpeed: number;
  /** Multiplier applied to `walkSpeed` while `isRunning`. Default 1.8. */
  runSpeedMultiplier: number;
  /** Multiplier applied to `walkSpeed` while `isCrouching`. Default 0.5. */
  crouchSpeedMultiplier: number;
  /** Capsule `centersDistance` used while `isCrouching`. Must be smaller than `centersDistance`. */
  crouchCentersDistance: number;
  /**
   * Not consumed by this class - carried here purely so an input driver (e.g.
   * `PlayerCharacterController2d`) can read the crouch key behavior from the same options object
   * used to configure the character itself. `'hold'`: crouch while the key is held, stand up on
   * release (subject to the headroom check above). `'toggle'`: each press flips `isCrouching`.
   * Default `'hold'`.
   */
  crouchMode: 'hold' | 'toggle';
  /** Takeoff vertical speed applied by `jump()`, opposing gravity along `up`. Default 5. */
  jumpSpeed: number;
  /**
   * Downward acceleration integrated while airborne, along `up`, **overriding** the world's own
   * `physicsWorld.gravity` for this character. Leave `undefined` (the default) to instead track
   * `physicsWorld.gravity` live every tick, full vector - direction and magnitude - exactly like it
   * would affect a dynamic rigid body. See `CharacterController3dEntityOptions.gravity`'s doc for
   * the full rationale (identical here, just in 2D).
   */
  gravity: number | undefined;
  /**
   * How fast horizontal movement can be *steered* while airborne, as a fraction of the current
   * walk/run speed applied per second of acceleration (0..1) - see
   * `CharacterController3dEntityOptions.airControlFactor`'s doc. Default 0.3.
   */
  airControlFactor: number;
};

/**
 * Input a possessing peer forwards for a `CharacterController2dEntity` - see `INetworkInputDriven`.
 * `jumpSeq` is the possessor's `jumpCount`: a replica jumps once per observed increment.
 */
export interface CharacterInput2d {
  moveDirection: number;
  isRunning: boolean;
  isCrouching: boolean;
  jumpSeq: number;
}

/**
 * Runtime state of a `CharacterController2dEntity` a spawn-time `config` can't reflect - emitted as
 * the 2D `"Player"` class's `config.state` by `serializeSettings` and applied back by the loader.
 */
export interface CharacterState2d {
  isCrouching?: boolean;
  isRunning?: boolean;
  moveDirection?: number;
  fallVelocity?: Point2;
  airHorizontalVelocity?: Point2;
}

const DEFAULT_OPTIONS: Required<
  Omit<CharacterController2dEntityOptions, 'radius' | 'centersDistance' | 'crouchCentersDistance'>
> = {
  offset: 0.01,
  maxStepHeight: 0.3,
  minStepWidth: 0.2,
  maxSlopeClimbAngleRad: (50 * Math.PI) / 180,
  snapToGroundDistance: 0.3,
  up: Pnt2.nY,
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
 * A capsule-bodied, physics-driven character entity: walk/run/crouch/jump gameplay logic that works
 * identically on top of any physics backend implementing `ICharacterController2dComponent` (see
 * that interface's doc for why - all of gravity/jump/speed/crouch integration happens here, not in
 * the backend-specific component). Reusable for the player (see a `PlayerCharacterController2d`
 * input driver) or for an NPC driven by AI logic instead. Mirrors `CharacterController3dEntity`
 * closely - see that class's own doc for the full reasoning behind the momentum-tracking/
 * ceiling-block/ground-walkability/crouch-capsule-swap logic below, which is identical here just
 * projected into 2D.
 *
 * `moveDirection` is a single signed scalar (not a vector): this engine's 2D world is always a
 * side-view/platformer ground plane (gravity pulls along `up`, see `Gg2dWorldTypeDocRepo`'s own
 * `gravity` console command default of `{x:0,y:9.82}`) rather than a top-down one, so the only
 * horizontal choice a character ever has is "which way along the ground plane's side axis" - there
 * is no separate forward/strafe axis the way a free-look 3D character has. Positive moves along
 * `Pnt2.rot(up, Math.PI/2)` (world `+X` for the default `up: {x:0,y:-1}`), negative the opposite way;
 * magnitude beyond `1` is not clamped (an analog input source is free to send a fractional/scaled
 * value, exactly like `walkSpeed * moveDirection` would suggest).
 */
export class CharacterController2dEntity<TypeDoc extends Gg2dWorldTypeDocRepo = Gg2dWorldTypeDocRepo>
  extends IRenderable2dEntity<TypeDoc>
  implements
    IPositionable2d,
    INetworkSyncable<MoverNetState<Point2, number>>,
    INetworkInputDriven<CharacterInput2d>,
    ISerializableEntity
{
  static readonly entityTypeName: string = 'CharacterController2dEntity';
  public readonly tickOrder = TickOrder.PHYSICS_SIMULATION - 5;

  public readonly options: Required<CharacterController2dEntityOptions>;

  /** Desired horizontal move direction/speed fraction - see this class's own doc. Set by an input
   * driver. */
  public moveDirection: number = 0;
  /** Whether to move at `walkSpeed * runSpeedMultiplier`. */
  public isRunning: boolean = false;

  /** Which way the character last moved (or faced) - `1` for along `right`, `-1` for against it.
   * Purely a convenience for a driver that flips a sprite horizontally (see
   * `CharacterAnimation2dController`) - never affects movement/physics itself, unlike `rotation`. */
  private _facing: 1 | -1 = 1;
  public get facing(): 1 | -1 {
    return this._facing;
  }

  /** Full 2D velocity accumulated from gravity (and jump takeoff) while not stably resting on a
   * walkable surface - see `CharacterController3dEntity`'s doc for why this is a full vector, not
   * just a scalar along `up`. */
  private _fallVelocity: Point2 = Pnt2.O;
  /** Horizontal velocity carried while airborne - see `CharacterController3dEntity`'s doc. Always
   * `Pnt2.O` while resting on the ground, where movement is direct instead. */
  private _airHorizontalVelocity: Point2 = Pnt2.O;
  /** Whether the previous `updateMovement` tick was stably resting on the ground. */
  private _wasResting: boolean = true;
  /** Set by `jump()`; consumed the first tick the adapter genuinely agrees the character has left
   * the ground - see `CharacterController3dEntity._justJumped`'s doc for the full rationale. */
  private _justJumped: boolean = false;

  /**
   * Extra translation folded into the next tick's `move()` call (added to the desired translation,
   * then cleared) - lets something other than the input driver nudge the character while still
   * sliding against geometry, instead of teleporting it through the `position` setter. The network
   * layer's replica correction (`MoverCorrection`) writes this.
   */
  public externalDisplacement: Point2 = Pnt2.O;

  private _jumpCount: number = 0;

  /** How many jumps `jump()` has actually performed (a call while not on walkable ground doesn't
   * count). Forwarded as `CharacterInput2d.jumpSeq` so replicas fire each jump exactly once. */
  public get jumpCount(): number {
    return this._jumpCount;
  }

  private _actualVelocity: Point2 = Pnt2.O;

  /** The velocity this character actually moved at on its last tick (displacement after collision
   * resolution divided by the tick's duration) - unlike `velocity`, it includes grounded walking. */
  public get actualVelocity(): Point2 {
    return this._actualVelocity;
  }

  /**
   * The `display` settings a level loader built this character from, echoed back by
   * `serializeSettings`. Set by `Gg2dLevelLoader`'s `"Player"` class.
   */
  public displaySettings: Record<string, any> | undefined = undefined;

  // last jumpSeq observed from remote input, null until the first remote sample (see applyRemoteInput)
  private _remoteJumpSeq: number | null = null;

  private _isCrouching: boolean = false;
  private _wantsToStand: boolean = false;

  /** Public accessor for `_fallVelocity` - see `CharacterController3dEntity.fallVelocity`'s doc. */
  public get fallVelocity(): Point2 {
    return this._fallVelocity;
  }

  public set fallVelocity(value: Point2) {
    this._fallVelocity = value;
  }

  /** Public accessor for `_airHorizontalVelocity` - see `CharacterController3dEntity.airHorizontalVelocity`'s doc. */
  public get airHorizontalVelocity(): Point2 {
    return this._airHorizontalVelocity;
  }

  public set airHorizontalVelocity(value: Point2) {
    this._airHorizontalVelocity = value;
  }

  /** `fallVelocity + airHorizontalVelocity` - this character's full current momentum in one vector. */
  public get velocity(): Point2 {
    return Pnt2.add(this._fallVelocity, this._airHorizontalVelocity);
  }

  public get isCrouching(): boolean {
    return this._isCrouching;
  }

  /**
   * Crouching down always succeeds immediately. Standing back up first raycasts straight up (along
   * `up`) for the extra height needed and only actually stands once that space is clear - if
   * blocked, the request is remembered (`_wantsToStand`) and retried every tick until it succeeds,
   * so the character never pops through a ceiling. See `CharacterController3dEntity.isCrouching`'s
   * doc for the full rationale (identical here, just in 2D).
   */
  public set isCrouching(value: boolean) {
    if (!this.world) {
      // not spawned: there's no physics world to rebuild the capsule against yet - remember the
      // flag, and onSpawned brings the capsule in line with it (keeping the position as set)
      this._isCrouching = value;
      this._wantsToStand = false;
      return;
    }
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

  public get groundNormal(): Point2 | null {
    return this.characterController.groundNormal;
  }

  public object2D: TypeDoc['vTypeDoc']['displayObject'] | null;
  public characterController: TypeDoc['pTypeDoc']['characterController'];

  private _position: Point2 = Pnt2.O;
  public get position(): Point2 {
    return this._position;
  }

  public set position(value: Point2) {
    this.characterController.position = value;
    if (this.object2D) {
      this.object2D.position = value;
    }
    this._position = value;
  }

  private _rotation: number = 0;
  public get rotation(): number {
    return this._rotation;
  }

  public set rotation(value: number) {
    this.characterController.rotation = value;
    if (this.object2D) {
      this.object2D.rotation = value;
    }
    this._rotation = value;
  }

  public updateVisibility(): void {
    if (this.object2D) {
      this.object2D.visible = this.worldVisible;
    }
    super.updateVisibility();
  }

  constructor(
    options: Partial<CharacterController2dEntityOptions> &
      Pick<CharacterController2dEntityOptions, 'radius' | 'centersDistance'>,
    object2D: TypeDoc['vTypeDoc']['displayObject'] | null,
    characterController: TypeDoc['pTypeDoc']['characterController'],
  ) {
    super();
    this.options = {
      ...DEFAULT_OPTIONS,
      crouchCentersDistance: options.centersDistance * 0.6,
      ...options,
    };
    this.object2D = object2D;
    this.characterController = characterController;
    if (characterController.name) {
      this.name = characterController.name;
    }
    this.addComponents(characterController);
    if (object2D) {
      this.addComponents(object2D);
    }
    this._position = characterController.position;
    this._rotation = characterController.rotation;
  }

  onSpawned(world: Gg2dWorld<TypeDoc>) {
    super.onSpawned(world);
    const expectedCentersDistance = this._isCrouching
      ? this.options.crouchCentersDistance
      : this.options.centersDistance;
    if (this.characterController.centersDistance !== expectedCentersDistance) {
      // the position was set for the capsule as it should be (a serialized crouching character
      // stores its crouched capsule's center) - keep it rather than the feet of the placeholder one
      this.recreateCapsule(expectedCentersDistance, true);
    }
    // until removed: an entity may be removed from the world and added again
    this.tick$.pipe(takeUntil(this._onRemoved$)).subscribe(([_, delta]) => this.updateMovement(delta));
  }

  /** This character's current gravitational acceleration as a full 2D vector - see
   * `CharacterController3dEntity.gravityVector`'s doc for the full rationale. */
  private get gravityVector(): Point2 {
    if (this.options.gravity !== undefined) {
      return Pnt2.scalarMult(this.characterController.up, -this.options.gravity);
    }
    return this.world?.physicsWorld?.gravity ?? Pnt2.O;
  }

  /** `gravityVector`'s own component along `up` (positive = accelerating upward). */
  private get gravityAlongUp(): number {
    return Pnt2.dot(this.gravityVector, this.characterController.up);
  }

  /** Whether the current `groundNormal` is shallow enough to walk on, per `maxSlopeClimbAngleRad`. */
  private get isWalkableGround(): boolean {
    const normal = this.groundNormal;
    return normal !== null && Pnt2.angle(normal, this.characterController.up) <= this.options.maxSlopeClimbAngleRad;
  }

  /**
   * Triggers a jump (a takeoff velocity away from the ground, opposing gravity) only while stably
   * grounded - see `CharacterController3dEntity.jump()`'s doc for the full rationale (identical
   * here, just in 2D).
   */
  public jump(): void {
    if (this.isGrounded && this.isWalkableGround) {
      const up = this.characterController.up;
      const direction = this.gravityAlongUp > 0 ? -1 : 1;
      const currentAlongUp = Pnt2.dot(this._fallVelocity, up);
      this._fallVelocity = Pnt2.add(
        this._fallVelocity,
        Pnt2.scalarMult(up, direction * this.options.jumpSpeed - currentAlongUp),
      );
      this._justJumped = true;
      this._jumpCount++;
    }
  }

  private updateMovement(deltaMs: number): void {
    const dt = deltaMs / 1000;
    const up = this.characterController.up;
    const right = Pnt2.rot(up, Math.PI / 2);
    const gravityVector = this.gravityVector;
    const gravityAlongUp = Pnt2.dot(gravityVector, up);
    const restingOnGround = this.isGrounded && this.isWalkableGround && gravityAlongUp <= 0;
    const grounded = restingOnGround && !this._justJumped;

    if (grounded) {
      this._fallVelocity = Pnt2.O;
    } else if (!restingOnGround) {
      this._fallVelocity = Pnt2.add(this._fallVelocity, Pnt2.scalarMult(gravityVector, dt));
      this._justJumped = false;
    }

    let speed = this.options.walkSpeed;
    if (this._isCrouching) {
      speed *= this.options.crouchSpeedMultiplier;
    } else if (this.isRunning) {
      speed *= this.options.runSpeedMultiplier;
    }
    const desiredHoriz = Pnt2.scalarMult(right, speed * this.moveDirection);
    if (this.moveDirection !== 0) {
      this._facing = this.moveDirection > 0 ? 1 : -1;
    }

    let horizontalVelocity: Point2;
    if (grounded) {
      this._airHorizontalVelocity = Pnt2.O;
      horizontalVelocity = desiredHoriz;
    } else if (this._wasResting) {
      this._airHorizontalVelocity = desiredHoriz;
      horizontalVelocity = desiredHoriz;
    } else {
      const delta = Pnt2.sub(desiredHoriz, this._airHorizontalVelocity);
      const deltaLen = Pnt2.len(delta);
      const maxDelta = this.options.airControlFactor * speed * dt;
      this._airHorizontalVelocity =
        deltaLen <= maxDelta
          ? desiredHoriz
          : Pnt2.add(this._airHorizontalVelocity, Pnt2.scalarMult(delta, maxDelta / deltaLen));
      horizontalVelocity = this._airHorizontalVelocity;
    }
    this._wasResting = grounded;

    const desiredTranslation = Pnt2.add(
      Pnt2.add(Pnt2.scalarMult(horizontalVelocity, dt), Pnt2.scalarMult(this._fallVelocity, dt)),
      this.externalDisplacement,
    );
    this.externalDisplacement = Pnt2.O;

    const previousPosition = this._position;
    this.characterController.move(desiredTranslation, dt);

    this._position = this.characterController.position;
    this._rotation = this.characterController.rotation;
    if (this.object2D) {
      this.object2D.position = this._position;
      this.object2D.rotation = this._rotation;
    }
    this._actualVelocity = dt > 0 ? Pnt2.scalarMult(Pnt2.sub(this._position, previousPosition), 1 / dt) : Pnt2.O;

    // Detect being blocked from above (e.g. jumping into a ceiling) while airborne and ascending -
    // see `CharacterController3dEntity.updateMovement`'s doc for the full rationale.
    if (!grounded) {
      const fallAlongUp = Pnt2.dot(this._fallVelocity, up);
      const desiredUp = Pnt2.dot(desiredTranslation, up);
      if (fallAlongUp > 0 && desiredUp > 0) {
        const actualUp = Pnt2.dot(Pnt2.sub(this._position, previousPosition), up);
        const tolerance = Math.max(this.options.offset, 1e-4);
        if (actualUp < desiredUp - tolerance) {
          this._fallVelocity = Pnt2.sub(this._fallVelocity, Pnt2.scalarMult(up, fallAlongUp));
        }
      }
    }

    // Only ever attempt the headroom check while actually resting on something - see
    // `tryStandUp`'s own doc for why airborne is unsafe to check at all, not just unnecessary. It
    // retries again automatically the moment `isGrounded` goes back to `true`, per
    // `_wantsToStand`'s own "retried every tick until it succeeds" contract - see
    // `CharacterController3dEntity.updateMovement`'s doc for the full rationale (identical here,
    // just in 2D).
    if (this._wantsToStand && this.isGrounded) {
      this.tryStandUp();
    }
  }

  /**
   * Raycasts straight up (along `up`) from the current (crouched) capsule's top by the extra height
   * standing would need - see `CharacterController3dEntity.tryStandUp`'s doc for the full rationale
   * behind the ray's placement/only-while-grounded restriction (identical here, just in 2D).
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
    const currentTop = Pnt2.add(
      this.position,
      Pnt2.scalarMult(up, this.characterController.radius + this.options.crouchCentersDistance / 2),
    );
    const from = Pnt2.add(currentTop, Pnt2.scalarMult(up, skin));
    const to = Pnt2.add(currentTop, Pnt2.scalarMult(up, heightDiff));
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
   * `centersDistance`, keeping the character's feet planted in place - see
   * `CharacterController3dEntity.recreateCapsule`'s doc for the full rationale (identical here, just
   * in 2D).
   * `keepCenter` keeps the capsule center where it is instead (the spawn-time rebuild).
   */
  private recreateCapsule(newCentersDistance: number, keepCenter = false): void {
    if (!this.world?.physicsWorld) {
      // not spawned yet; nothing to recreate against
      return;
    }
    const old = this.characterController;
    const up = old.up;
    const feetPoint = Pnt2.sub(this.position, Pnt2.scalarMult(up, old.radius + old.centersDistance / 2));
    const newPosition = keepCenter
      ? this.position
      : Pnt2.add(feetPoint, Pnt2.scalarMult(up, old.radius + newCentersDistance / 2));

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
    // Carry over `ignoredBodies` - see `CharacterController3dEntity.recreateCapsule`'s doc for why.
    for (const ignored of old.ignoredBodies) {
      created.ignoredBodies.add(ignored);
    }

    // `dispose: true` here is load-bearing, not decoration - see
    // `CharacterController3dEntity.recreateCapsule`'s doc and `ICharacterController2dComponent`'s
    // own doc for the general `removeFromWorld(dispose)` contract this relies on.
    this.removeComponents([old], true);
    this.characterController = created;
    this.addComponents(created);
    this._position = created.position;
    this._rotation = created.rotation;
    if (this.object2D) {
      this.object2D.position = this._position;
      this.object2D.rotation = this._rotation;
    }
  }

  /** `INetworkSyncable`: owner-side snapshot - see `MoverCorrection`. */
  public captureNetworkState(): MoverNetState<Point2, number> {
    return MoverCorrection.capture(this);
  }

  /** `INetworkSyncable`: replica-side reconciliation through `externalDisplacement` - see `MoverCorrection`. */
  public applyNetworkState(target: MoverNetState<Point2, number>, ctx: NetworkApplyContext): CorrectionOutcome {
    return MoverCorrection.correct(this, target, ctx);
  }

  /** `INetworkInputDriven`: what the local input driver set on this character. */
  public captureLocalInput(): CharacterInput2d {
    return {
      moveDirection: this.moveDirection,
      isRunning: this.isRunning,
      isCrouching: this._isCrouching,
      jumpSeq: this._jumpCount,
    };
  }

  /**
   * `INetworkInputDriven`: drive this replica with the possessor's input; `null` is neutral (no
   * movement, not running). A jump fires once per observed `jumpSeq` increment; the first sample
   * only records the baseline, so a replica created mid-session never replays old jumps.
   */
  public applyRemoteInput(input: CharacterInput2d | null): void {
    if (input === null) {
      this.moveDirection = 0;
      this.isRunning = false;
      this._remoteJumpSeq = null;
      return;
    }
    this.moveDirection = input.moveDirection;
    this.isRunning = input.isRunning;
    if (input.isCrouching !== this._isCrouching) {
      this.isCrouching = input.isCrouching;
    }
    if (this._remoteJumpSeq !== null && input.jumpSeq > this._remoteJumpSeq) {
      this.jump();
    }
    this._remoteJumpSeq = input.jumpSeq;
  }

  /**
   * `ISerializableEntity`: the 2D `"Player"` class's `config` - capsule size, every option that
   * differs from its default, `display` (from `displaySettings`, else the auto-generated capsule
   * sprite's material) and a `state` block with the runtime movement state (see `CharacterState2d`).
   */
  public serializeSettings(): { config: Record<string, any> } {
    const config: Record<string, any> = {
      radius: this.options.radius,
      centersDistance: this.options.centersDistance,
    };
    for (const [key, defaultValue] of Object.entries(DEFAULT_OPTIONS)) {
      const value = (this.options as Record<string, any>)[key];
      if (value !== undefined && JSON.stringify(value) !== JSON.stringify(defaultValue)) {
        config[key] = value;
      }
    }
    if (this.options.crouchCentersDistance !== this.options.centersDistance * 0.6) {
      config.crouchCentersDistance = this.options.crouchCentersDistance;
    }
    if (this.displaySettings) {
      config.display = this.displaySettings;
    } else if (isMaterialReadable2d(this.object2D)) {
      config.display = this.object2D.materialOptions;
    }
    config.state = {
      isCrouching: this._isCrouching,
      isRunning: this.isRunning,
      moveDirection: this.moveDirection,
      fallVelocity: this._fallVelocity,
      airHorizontalVelocity: this._airHorizontalVelocity,
    } as CharacterState2d;
    return { config };
  }

  /** Apply a `CharacterState2d` block (see `serializeSettings`); every field is optional. */
  public applyState(state: CharacterState2d): void {
    if (state.isCrouching !== undefined) {
      this.isCrouching = state.isCrouching;
    }
    if (state.isRunning !== undefined) {
      this.isRunning = state.isRunning;
    }
    if (state.moveDirection !== undefined) {
      this.moveDirection = state.moveDirection;
    }
    if (state.fallVelocity !== undefined) {
      this._fallVelocity = state.fallVelocity;
    }
    if (state.airHorizontalVelocity !== undefined) {
      this._airHorizontalVelocity = state.airHorizontalVelocity;
      if (Pnt2.lenSq(state.airHorizontalVelocity) > 0) {
        // carried airborne momentum: don't let the next tick re-seed it from ground speed
        this._wasResting = false;
      }
    }
  }
}
