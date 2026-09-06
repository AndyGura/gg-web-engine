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
  /** Takeoff vertical speed applied by `jump()`, in m/s. Default 5. */
  jumpSpeed: number;
  /** Downward acceleration integrated while airborne, in m/s². Default 9.82. */
  gravity: number;
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
  walkSpeed: 4,
  runSpeedMultiplier: 1.8,
  crouchSpeedMultiplier: 0.5,
  crouchMode: 'hold',
  jumpSpeed: 5,
  gravity: 9.82,
  airControlFactor: 0.3,
};

/**
 * A capsule-bodied, physics-driven character entity: walk/run/crouch/jump gameplay logic that
 * works identically on top of any physics backend implementing `ICharacterController3dComponent`
 * (see that interface's doc for why - all of gravity/jump/speed integration happens here, not in
 * the backend-specific component). Reusable for the player (see `PlayerCharacterController`, which
 * adds keyboard/mouse input and a camera on top of this) or for an NPC driven by AI logic instead.
 *
 * `moveDirection` is local-space (rotated by `this.rotation` internally), using the same
 * "local -Z is forward, local +X is right" convention `FreeCameraController` uses for its own
 * movement vector - a `PlayerCharacterController` (or any other driver) maps input to it using
 * the identical construction.
 */
export class CharacterController3dEntity<TypeDoc extends Gg3dWorldTypeDocRepo = Gg3dWorldTypeDocRepo>
  extends IRenderable3dEntity<TypeDoc>
  implements IPositionable3d
{
  public readonly tickOrder = TickOrder.PHYSICS_SIMULATION - 5;

  public readonly options: Required<CharacterController3dEntityOptions>;

  /** Local-space desired move direction (XZ plane, "-Z forward / +X right"); set by an input driver. */
  public moveDirection: Point3 = Pnt3.O;
  /** Whether to move at `walkSpeed * runSpeedMultiplier`. Ignored while `isCrouching`. */
  public isRunning: boolean = false;

  private _isCrouching: boolean = false;
  private _wantsToStand: boolean = false;
  private _verticalVelocity: number = 0;

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

  /** Triggers a jump (sets vertical takeoff speed) only while grounded; a no-op mid-air. */
  public jump(): void {
    if (this.isGrounded) {
      this._verticalVelocity = this.options.jumpSpeed;
    }
  }

  private updateMovement(deltaMs: number): void {
    const dt = deltaMs / 1000;
    const grounded = this.isGrounded;
    const up = this.characterController.up;

    // clamp settling/falling velocity on landing, but never clobber a just-triggered jump
    if (grounded && this._verticalVelocity < 0) {
      this._verticalVelocity = 0;
    }
    if (!grounded) {
      this._verticalVelocity -= this.options.gravity * dt;
    }

    let speed = this.options.walkSpeed;
    if (this._isCrouching) {
      speed *= this.options.crouchSpeedMultiplier;
    } else if (this.isRunning) {
      speed *= this.options.runSpeedMultiplier;
    }
    if (!grounded) {
      speed *= this.options.airControlFactor;
    }

    const localHoriz = Pnt3.norm({ x: this.moveDirection.x, y: 0, z: this.moveDirection.z });
    const worldHoriz = Pnt3.rot(Pnt3.scalarMult(localHoriz, speed), this.rotation);
    const desiredTranslation = Pnt3.add(
      Pnt3.scalarMult(worldHoriz, dt),
      Pnt3.scalarMult(up, this._verticalVelocity * dt),
    );

    this.characterController.move(desiredTranslation);

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
