import { filter, takeUntil } from 'rxjs';
import {
  DirectionKeyboardInput,
  DirectionKeyboardKeymap,
  GgWorld,
  IEntity,
  KeyboardInput,
  MouseInput,
  MouseInputOptions,
  MutablePoint3,
  MutableSpherical,
  Pnt3,
  Qtrn,
  TickOrder,
} from '../../../../base';
import { Renderer3dEntity } from '../../renderer-3d.entity';
import { CharacterController3dEntity } from '../../character-controller-3d.entity';
import { Gg3dWorldTypeDocRepo } from '../../../gg-3d-world';

export type PlayerCharacterControllerViewMode = 'first-person' | 'third-person';

/**
 * Options for configuring a `PlayerCharacterController`.
 */
export type PlayerCharacterControllerOptions = {
  /** Keymap for walk/strafe direction. 'wasd+arrows' by default (both layouts work at once). */
  keymap: DirectionKeyboardKeymap;
  /** Key code that triggers `character.jump()`. 'Space' by default. */
  jumpKey: string;
  /** Key code that sets `character.isRunning`. 'ShiftLeft' by default. */
  runKey: string;
  /** Key code that drives `character.isCrouching`, per `character.options.crouchMode`. 'ControlLeft' by default. */
  crouchKey: string;
  /** Key code that calls `toggleViewMode()`. 'KeyV' by default; `null` disables the toggle. */
  toggleViewKey: string | null;
  /** Initial view mode. 'first-person' by default. */
  viewMode: PlayerCharacterControllerViewMode;
  /** First-person camera height above the capsule's center, along `up`. Default 0.7. */
  eyeHeight: number;
  /** Third-person camera distance behind the look target. Default 4. */
  thirdPersonDistance: number;
  /** Height of the third-person look target above the capsule's center, along `up`. Default 0.6. */
  thirdPersonHeight: number;
  /** Mouse-look sensitivity, in radians per 1000px of mouse movement. Default 1. */
  mouseSensitivity: number;
  /** Minimum look pitch (radians, negative = down). Default ~-89°. */
  minPitch: number;
  /** Maximum look pitch (radians, positive = up). Default ~89°. */
  maxPitch: number;
  /**
   * Whether the third-person camera raycasts from the look target towards its desired position
   * and pulls in when something obstructs it, to avoid clipping through geometry. Default true.
   */
  cameraCollision: boolean;
  /** Gap kept between the camera and an obstruction it was pulled in against. Default 0.2. */
  cameraCollisionMargin: number;
  /** Options for the underlying `MouseInput` (e.g. `canvas` for pointer lock). `pointerLock: true` by default. */
  mouseOptions: Partial<MouseInputOptions>;
};

const DEFAULT_OPTIONS: PlayerCharacterControllerOptions = {
  keymap: 'wasd+arrows',
  jumpKey: 'Space',
  runKey: 'ShiftLeft',
  crouchKey: 'ControlLeft',
  toggleViewKey: 'KeyV',
  viewMode: 'first-person',
  eyeHeight: 0.7,
  thirdPersonDistance: 4,
  thirdPersonHeight: 0.6,
  mouseSensitivity: 1,
  minPitch: -Math.PI * 0.49,
  maxPitch: Math.PI * 0.49,
  cameraCollision: true,
  cameraCollisionMargin: 0.2,
  mouseOptions: { pointerLock: true },
};

/**
 * The player's input+camera controller: WASD/arrows/both movement, sprint, crouch and jump keys,
 * and mouse-look driving a first- or third-person camera - all layered on top of a plain
 * `CharacterController3dEntity`, which owns the actual movement/gravity/jump physics. Mirrors
 * `GgCarKeyboardHandlingController` (input entity driving a separate physics entity) crossed with
 * `FreeCameraController` (mouse-look + pointer lock via the same `MouseInput`/`DirectionKeyboardInput`
 * primitives).
 *
 * The character's yaw always follows the camera's yaw (mouse-look), in both view modes - `WASD`
 * movement is relative to that facing.
 */
export class PlayerCharacterController<TypeDoc extends Gg3dWorldTypeDocRepo = Gg3dWorldTypeDocRepo> extends IEntity {
  public readonly tickOrder = TickOrder.CONTROLLERS;

  protected readonly options: PlayerCharacterControllerOptions;

  public readonly mouseInput: MouseInput;
  public readonly directionsInput: DirectionKeyboardInput;

  private _spherical: MutableSpherical = { phi: Math.PI / 2, theta: 0, radius: 1 };
  private _viewMode: PlayerCharacterControllerViewMode;

  public get viewMode(): PlayerCharacterControllerViewMode {
    return this._viewMode;
  }

  public set viewMode(value: PlayerCharacterControllerViewMode) {
    this._viewMode = value;
    if (this.character) {
      this.character.hideMesh = value === 'first-person';
    }
  }

  public toggleViewMode(): void {
    this.viewMode = this._viewMode === 'first-person' ? 'third-person' : 'first-person';
  }

  get active(): boolean {
    return super.active;
  }

  set active(value: boolean) {
    if (!super.active && value) {
      this.reset();
    }
    super.active = value;
  }

  public reset(): void {
    this._spherical = Pnt3.toSpherical(Pnt3.rot({ x: 0, y: 0, z: -1 }, this.camera.rotation));
  }

  constructor(
    protected readonly keyboard: KeyboardInput,
    /** The character this controller drives. May be swapped/set to `null` at any time. */
    public character: CharacterController3dEntity<TypeDoc> | null,
    protected readonly camera: Renderer3dEntity<TypeDoc['vTypeDoc']>,
    options: Partial<PlayerCharacterControllerOptions> = {},
  ) {
    super();
    this.options = {
      ...DEFAULT_OPTIONS,
      ...options,
      mouseOptions: { ...DEFAULT_OPTIONS.mouseOptions, ...options.mouseOptions },
    };
    this._viewMode = this.options.viewMode;
    this.mouseInput = new MouseInput(this.options.mouseOptions);
    this.directionsInput = new DirectionKeyboardInput(keyboard, this.options.keymap);
    if (this.character) {
      this.character.hideMesh = this._viewMode === 'first-person';
    }
  }

  async onSpawned(world: GgWorld<any, any>): Promise<void> {
    super.onSpawned(world);
    this.reset();

    this.directionsInput.output$.pipe(takeUntil(this._onRemoved$)).subscribe(({ upDown, leftRight }) => {
      const local: MutablePoint3 = { x: 0, y: 0, z: 0 };
      if (leftRight !== undefined) local.x = leftRight ? -1 : 1;
      if (upDown !== undefined) local.z = upDown ? -1 : 1;
      if (this.character) {
        this.character.moveDirection = local;
      }
    });

    this.keyboard
      .bind(this.options.jumpKey)
      .pipe(
        takeUntil(this._onRemoved$),
        filter(down => this.active && down),
      )
      .subscribe(() => this.character?.jump());

    this.keyboard
      .bind(this.options.runKey)
      .pipe(takeUntil(this._onRemoved$))
      .subscribe(down => {
        if (this.character) {
          this.character.isRunning = down;
        }
      });

    this.keyboard
      .bind(this.options.crouchKey)
      .pipe(takeUntil(this._onRemoved$))
      .subscribe(down => {
        if (!this.character) {
          return;
        }
        if (this.character.options.crouchMode === 'toggle') {
          if (down) {
            this.character.isCrouching = !this.character.isCrouching;
          }
        } else {
          this.character.isCrouching = down;
        }
      });

    if (this.options.toggleViewKey) {
      this.keyboard
        .bind(this.options.toggleViewKey)
        .pipe(
          takeUntil(this._onRemoved$),
          filter(down => this.active && down),
        )
        .subscribe(() => this.toggleViewMode());
    }

    this.mouseInput.delta$.pipe(takeUntil(this._onRemoved$)).subscribe(delta => {
      this._spherical.theta -= (delta.x * this.options.mouseSensitivity) / 1000;
      const pitchToPhi = (pitch: number) => Math.PI / 2 - pitch;
      const phiMin = pitchToPhi(this.options.maxPitch);
      const phiMax = pitchToPhi(this.options.minPitch);
      this._spherical.phi = Math.max(
        phiMin,
        Math.min(phiMax, this._spherical.phi + (delta.y * this.options.mouseSensitivity) / 1000),
      );
    });

    this.tick$
      .pipe(
        takeUntil(this._onRemoved$),
        filter(() => this.active),
      )
      .subscribe(() => this.updateCamera());

    await this.mouseInput.start();
    await this.directionsInput.start();
  }

  async onRemoved(): Promise<void> {
    await super.onRemoved();
    await this.mouseInput.stop(true);
    await this.directionsInput.stop();
  }

  private updateCamera(): void {
    const lookDir = Pnt3.fromSpherical(this._spherical);
    const up = this.character?.characterController.up ?? Pnt3.Z;
    const yawDir = Pnt3.fromSpherical({ theta: this._spherical.theta, phi: Math.PI / 2, radius: 1 });

    if (this.character) {
      this.character.rotation = Qtrn.lookAt(Pnt3.O, yawDir, up);
    }

    if (!this.character) {
      this.camera.rotation = Qtrn.lookAt(this.camera.position, Pnt3.add(this.camera.position, lookDir));
      return;
    }

    if (this._viewMode === 'first-person') {
      this.camera.position = Pnt3.add(this.character.position, Pnt3.scalarMult(up, this.options.eyeHeight));
    } else {
      const target = Pnt3.add(this.character.position, Pnt3.scalarMult(up, this.options.thirdPersonHeight));
      let distance = this.options.thirdPersonDistance;
      if (this.options.cameraCollision && this.character.world?.physicsWorld) {
        const desired = Pnt3.sub(target, Pnt3.scalarMult(lookDir, distance));
        const result = this.character.world.physicsWorld.raycast({ from: target, to: desired });
        if (result.hasHit && result.hitDistance !== undefined) {
          distance = Math.max(0, result.hitDistance - this.options.cameraCollisionMargin);
        }
      }
      this.camera.position = Pnt3.sub(target, Pnt3.scalarMult(lookDir, distance));
    }
    this.camera.rotation = Qtrn.lookAt(this.camera.position, Pnt3.add(this.camera.position, lookDir));
  }
}
