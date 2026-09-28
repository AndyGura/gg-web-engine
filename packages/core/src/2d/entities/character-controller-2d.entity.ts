import { Pnt2, Point2, TickOrder } from '../../base';
import { Gg2dWorld, Gg2dWorldTypeDocRepo } from '../gg-2d-world';
import { IRenderable2dEntity } from './i-renderable-2d.entity';
import { IPositionable2d } from '../interfaces/i-positionable-2d';
import { CharacterController2dOptions } from '../models/character-controller-options';

/**
 * Options for a `CharacterController2dEntity`: the capsule shape/mover tuning from
 * `CharacterController2dOptions`, plus the gameplay tuning (speed, jump, gravity) this entity owns
 * itself so behavior stays identical across physics backends - see the class doc. Mirrors
 * `CharacterController3dEntityOptions`, minus crouch (not a 2D side-scroller concept this engine
 * models - an app wanting a crouch pose can still drive one directly via `CharacterAnimation2dController`'s
 * `clipMap`/a custom animation state, it just isn't wired into movement/capsule-resize here the way
 * the 3D entity's `isCrouching` is).
 */
export type CharacterController2dEntityOptions = CharacterController2dOptions & {
  /** Walking speed, in world units/s. Default 4. */
  walkSpeed: number;
  /** Multiplier applied to `walkSpeed` while `isRunning`. Default 1.8. */
  runSpeedMultiplier: number;
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

const DEFAULT_OPTIONS: Required<Omit<CharacterController2dEntityOptions, 'radius' | 'centersDistance'>> = {
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
  jumpSpeed: 5,
  gravity: undefined,
  airControlFactor: 0.3,
};

/**
 * A capsule-bodied, physics-driven character entity: walk/run/jump gameplay logic that works
 * identically on top of any physics backend implementing `ICharacterController2dComponent` (see
 * that interface's doc for why - all of gravity/jump/speed integration happens here, not in the
 * backend-specific component). Reusable for the player (see a `PlayerCharacterController2d` input
 * driver) or for an NPC driven by AI logic instead. Mirrors `CharacterController3dEntity` closely -
 * see that class's own doc for the full reasoning behind the momentum-tracking/ceiling-block/
 * ground-walkability logic below, which is identical here just projected into 2D.
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
  implements IPositionable2d
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
    this.tick$.subscribe(([_, delta]) => this.updateMovement(delta));
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

    const speed = this.options.walkSpeed * (this.isRunning ? this.options.runSpeedMultiplier : 1);
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
      Pnt2.scalarMult(horizontalVelocity, dt),
      Pnt2.scalarMult(this._fallVelocity, dt),
    );

    const previousPosition = this._position;
    this.characterController.move(desiredTranslation, dt);

    this._position = this.characterController.position;
    this._rotation = this.characterController.rotation;
    if (this.object2D) {
      this.object2D.position = this._position;
      this.object2D.rotation = this._rotation;
    }

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
  }
}
