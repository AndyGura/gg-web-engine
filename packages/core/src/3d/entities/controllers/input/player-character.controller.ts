import { filter, Observable, takeUntil } from 'rxjs';
import {
  DirectionInput,
  DirectionKeymap,
  BindingsChange,
  IRebindableController,
  GAMEPAD_LEFT_STICK_OR_DPAD,
  GAMEPAD_RIGHT_STICK,
  GamepadControls,
  GamepadDirectionBinding,
  GgWorld,
  IEntity,
  KeyboardInput,
  MouseInput,
  MouseInputOptions,
  MutablePoint3,
  MutableSpherical,
  Pnt3,
  Point3,
  Qtrn,
  runWhileInputEnabled,
  SELF_VIEW_HIDDEN_RENDER_LAYER,
  TickOrder,
} from '../../../../base';
import { ControllerBindings } from '../../../../base/inputs/rebindable-keys';
import { Renderer3dEntity } from '../../renderer-3d.entity';
import { IFrameSwitchable } from '../../../interfaces/i-frame-switchable';
import { Frame3d } from '../../../models/frame-3d';
import { CharacterController3dEntity } from '../../character-controller-3d.entity';
import { Gg3dWorldTypeDocRepo } from '../../../gg-3d-world';
import { characterControllerSelfHitSkip } from './character-controller-self-hit-skip';

export type PlayerCharacterControllerViewMode = 'first-person' | 'third-person';

/** Which gamepad controls move, look and act - see `GamepadControl` for the control names */
export type CharacterGamepadBinding = {
  /** The walk/strafe direction, added to the direction input */
  move: GamepadDirectionBinding;
  /** The look direction: turns the view at `lookSpeed` at full deflection */
  look: GamepadDirectionBinding;
  /** How fast `look` turns the view at full deflection, in radians per second */
  lookSpeed: number;
  /** Presses `jumpKey` */
  jump: GamepadControls;
  /** Presses `runKey` */
  run: GamepadControls;
  /** Presses `crouchKey` */
  crouch: GamepadControls;
  /** Presses `toggleViewKey`; `null` for none */
  toggleView: GamepadControls | null;
};

/**
 * Left stick or d-pad walks, right stick looks, A jumps, the left stick's click runs, B crouches,
 * Y toggles the view
 */
export const DEFAULT_CHARACTER_GAMEPAD_BINDING: CharacterGamepadBinding = {
  move: GAMEPAD_LEFT_STICK_OR_DPAD,
  look: GAMEPAD_RIGHT_STICK,
  lookSpeed: 3,
  jump: 'b0',
  run: 'b10',
  crouch: 'b1',
  toggleView: 'b3',
};

/**
 * Options for configuring a `PlayerCharacterController`.
 */
export type PlayerCharacterControllerOptions = {
  /**
   * Keymap for walk/strafe direction: `'wasd+arrows'` by default (both layouts work at once), or
   * custom codes per direction. `setKeys` changes it while the game runs.
   */
  keymap: DirectionKeymap;
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
  /**
   * Flag to ignore cursor movement if pointer was not locked. `false` by default. Set this to
   * `true` (matching `mouseOptions: { pointerLock: true }`, the default) to stop stray mouse
   * movement over the page from spinning the view before the canvas has actually been clicked to
   * lock the pointer. Always ignored on a touch device (touch has no pointer-lock concept, and
   * `mouseInput.isPointerLocked` never becomes `true` there), mirroring
   * `FreeCameraControllerOptions`'s identically-named option.
   */
  ignoreMouseUnlessPointerLocked: boolean;
  /** Options for the underlying `MouseInput` (e.g. `canvas` for pointer lock). `pointerLock: true` by default. */
  mouseOptions: Partial<MouseInputOptions>;
  /**
   * The gamepad controls, bound on the world's `gamepadInput`: `move` goes to the direction input,
   * `look` turns the view (regardless of `ignoreMouseUnlessPointerLocked`), the buttons press the
   * keys above on `keyboard`. `DEFAULT_CHARACTER_GAMEPAD_BINDING` by default; `null` leaves the
   * gamepad alone. `setGamepad` changes it while the game runs.
   */
  gamepad: CharacterGamepadBinding | null;
};

/**
 * The keys of a `PlayerCharacterController`, which `setKeys` changes while the game runs
 */
export type PlayerCharacterControllerKeys = Pick<
  PlayerCharacterControllerOptions,
  'keymap' | 'jumpKey' | 'runKey' | 'crouchKey' | 'toggleViewKey'
>;

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
  mouseSensitivity: 2,
  minPitch: -Math.PI * 0.49,
  maxPitch: Math.PI * 0.49,
  cameraCollision: true,
  cameraCollisionMargin: 0.2,
  ignoreMouseUnlessPointerLocked: false,
  mouseOptions: { pointerLock: true },
  gamepad: DEFAULT_CHARACTER_GAMEPAD_BINDING,
};

/**
 * The player's input+camera controller: WASD/arrows/both movement, sprint, crouch and jump keys,
 * and mouse-look driving a first- or third-person camera - all layered on top of a plain
 * `CharacterController3dEntity`, which owns the actual movement/gravity/jump physics. Mirrors
 * `GgCarHandlingController` (input entity driving a separate physics entity) crossed with
 * `FreeCameraController` (mouse-look + pointer lock via the same `MouseInput`/`DirectionInput`
 * primitives).
 *
 * The character's yaw always follows the camera's yaw (mouse-look), in both view modes - `WASD`
 * movement is relative to that facing.
 *
 * @example
 * ```ts
 * import { CharacterController3dEntity, PlayerCharacterController } from '@gg-web-engine/core';
 *
 * // a capsule character from the built-in "Player" level class (0.4 m radius, standing on Z-up ground)
 * const player = (await world.loader.createEntity({
 *   class: 'Player',
 *   position: { x: 0, y: 0, z: 2 },
 *   config: { display: { color: 0x3388ff } },
 * })) as CharacterController3dEntity;
 * world.addEntity(player);
 *
 * const canvas = document.getElementById('gg') as HTMLCanvasElement;
 * const renderer = world.addRenderer(world.visualScene.factory.createPerspectiveCamera(), canvas);
 * const controller = new PlayerCharacterController(world.keyboardInput, player, renderer, {
 *   viewMode: 'third-person',
 *   mouseOptions: { canvas }, // click the canvas to lock the pointer for mouse-look
 * });
 * world.addEntity(controller);
 * // cutscene or menu: controller.active = false
 * ```
 */
export class PlayerCharacterController<TypeDoc extends Gg3dWorldTypeDocRepo = Gg3dWorldTypeDocRepo>
  extends IEntity
  implements IRebindableController, IFrameSwitchable
{
  static readonly entityTypeName: string = 'PlayerCharacterController';
  public readonly tickOrder = TickOrder.CONTROLLERS;

  public readonly options: PlayerCharacterControllerOptions;

  public readonly mouseInput: MouseInput;
  public readonly directionsInput: DirectionInput;

  private readonly bindings: ControllerBindings<PlayerCharacterControllerOptions, CharacterGamepadBinding>;

  /** Emits after every `setKeys` (`'keys'`) and `setGamepad` (`'gamepad'`) - see `IRebindableController` */
  public get bindingsChanged$(): Observable<BindingsChange> {
    return this.bindings.changed$;
  }

  /**
   * Rebinds keys while the game runs - for a controls menu. Only the keys given change; they are
   * written to `options` and take effect at once, keyboard and gamepad alike (the gamepad presses
   * whichever key its button is for). A key held while it is replaced stops counting, and a new
   * key already held counts from its next press.
   *
   * @example
   * ```ts
   * controller.setKeys({ jumpKey: 'KeyJ', keymap: { up: 'KeyI', down: 'KeyK', left: 'KeyJ', right: 'KeyL' } });
   * ```
   */
  public setKeys(keys: Partial<PlayerCharacterControllerKeys>): void {
    this.bindings.setKeys(keys);
  }

  /**
   * Rebinds the gamepad while the game runs - for a controls menu. The controls given replace the
   * current ones (over `DEFAULT_CHARACTER_GAMEPAD_BINDING` while the gamepad is off), `null` turns the
   * gamepad off. Written to `options.gamepad`, taking effect at once. A control held while it is
   * replaced stops counting, and one already held when it is assigned (the button a menu just
   * captured) counts from its next push.
   *
   * @example
   * ```ts
   * controller.setGamepad({ jump: 'b1', run: ['b10', 'b6'] });
   * ```
   */
  public setGamepad(binding: Partial<CharacterGamepadBinding> | null): void {
    this.bindings.setGamepad(binding);
  }

  /**
   * `this.camera.camera.fov` as it stood the moment this controller was constructed, before it ever
   * touched the camera itself - restored every time `viewMode` switches to `'third-person'` (see
   * that setter) and every time this controller (re-)activates while already in third-person (see
   * the `active` setter), the same way switching into a vehicle always sets a definite fov rather
   * than carrying over whatever a still-live `FreeCameraController` sharing the same
   * `Renderer3dEntity` left it at (its own scroll-wheel zoom, `cameraFovInc`, mutates
   * `camera.camera.fov` directly and permanently - see its own doc). Without both of those restore
   * points, zooming out in free-camera mode and then walking onto the character - whether that
   * switches `viewMode` explicitly or just reactivates this controller with `viewMode` already
   * `'third-person'` from a previous session - would leave the third-person view stuck at that
   * zoomed fov instead of the app's own configured default.
   */
  private readonly baseFov: number;

  private _spherical: MutableSpherical = { phi: Math.PI / 2, theta: 0, radius: 1 };
  // Definite-assignment asserted: always set via the `viewMode` setter at the end of the
  // constructor (`this.viewMode = this.options.viewMode`), not assigned directly - see that call's
  // own comment for why it's routed through the setter instead.
  private _viewMode!: PlayerCharacterControllerViewMode;

  public get viewMode(): PlayerCharacterControllerViewMode {
    return this._viewMode;
  }

  public set viewMode(value: PlayerCharacterControllerViewMode) {
    this._viewMode = value;
    const firstPerson = value === 'first-person';
    if (this.character) {
      this.character.hideMesh = firstPerson;
    }
    // `character.hideMesh` alone only moves the mesh onto `SELF_VIEW_HIDDEN_RENDER_LAYER` - nothing
    // stops seeing it there until *this* camera specifically excludes that layer (see
    // `CharacterController3dEntity.hideMesh`'s own doc). Every other camera in the world (a portal's
    // own "looking through" render pass, a third-person spectator view, ...) is never touched here
    // and keeps rendering every layer by default, so it keeps seeing this character's body
    // regardless of this camera's own first/third-person state.
    if (firstPerson) {
      this.camera.disableRenderLayer(SELF_VIEW_HIDDEN_RENDER_LAYER);
    } else {
      this.camera.enableRenderLayer(SELF_VIEW_HIDDEN_RENDER_LAYER);
      // Restore a definite fov every time third-person is (re-)entered, the same way switching into
      // a vehicle camera always does (see `baseFov`'s own doc) - `updateCamera()` itself never
      // touches fov at all, so without this a zoom left over from free-camera mode (or from
      // whatever the camera was doing before this controller became active) would otherwise persist
      // indefinitely in third-person view.
      this.camera.camera.fov = this.baseFov;
    }
  }

  /**
   * `IFrameSwitchable`: turns the look direction by `delta`'s yaw. The camera and the character are
   * entities the world moves itself; the next `updateCamera` places them from the turned look.
   */
  public onFrameSwitch(delta: Frame3d): void {
    this._spherical.theta += delta.yaw;
  }

  public toggleViewMode(): void {
    this.viewMode = this._viewMode === 'first-person' ? 'third-person' : 'first-person';
  }

  get active(): boolean {
    return super.active;
  }

  set active(value: boolean) {
    const wasActive = super.active;
    if (!wasActive && value) {
      this.reset();
      this.viewMode = this._viewMode;
    } else if (wasActive && !value) {
      // Neutralize whatever this controller last wrote to `character` so a deactivated controller
      // leaves it in a resting state instead of "stuck" mid-input (e.g. still walking forever if
      // `active` is set to `false` while a direction key is held down) - see the subscriptions
      // below, all now gated on `this.active` too so they stop writing anything further. Rotation is
      // deliberately left untouched: unlike movement/run/crouch, facing direction isn't an "input
      // held down" state that needs resetting on deactivation.
      if (this.character) {
        this.character.moveDirection = Pnt3.O;
        this.character.isRunning = false;
        if (this.character.options.crouchMode === 'hold') {
          this.character.isCrouching = false;
        }
      }
    }
    super.active = value;
  }

  public reset(): void {
    this._spherical = Pnt3.toSpherical(Pnt3.rot(Pnt3.nZ, this.camera.rotation));
  }

  /**
   * `Pnt3.fromSpherical(this._spherical)` - the same world-space look direction `updateCamera()`
   * itself derives every tick from the internal `_spherical` mouse-look state (that state has no
   * other public accessor at all otherwise). Read to get the current view direction; **write** to
   * nudge it by an arbitrary rotation without waiting for mouse input - most concretely, a future
   * portal-crossing implementation applying a portal pair's own delta rotation to the view the
   * instant the character crosses (exactly as `PortalGunController`'s existing
   * `getOppositePortalPositioning` already reorients a *held* `Grabbable3dEntity`'s rotation, just
   * with nothing today able to reach in and do the same to the player's own look direction).
   *
   * The written direction's pitch is clamped to `minPitch`/`maxPitch` the same way ordinary
   * mouse-look already is - see `clampPitch`. Only yaw/pitch are ever recovered from `value`
   * (`_spherical.radius` itself is meaningless here and left untouched) - a non-unit-length `value`
   * is fine, only its direction is used.
   */
  public get lookDirection(): Point3 {
    return Pnt3.fromSpherical(this._spherical);
  }

  public set lookDirection(value: Point3) {
    const spherical = Pnt3.toSpherical(value);
    this._spherical.theta = spherical.theta;
    this._spherical.phi = this.clampPitch(spherical.phi);
  }

  /** Shared by the mouse-look handler and `lookDirection`'s own setter - keeps both paths clamped to
   * the exact same `minPitch`/`maxPitch` bounds instead of maintaining the conversion twice. */
  private clampPitch(phi: number): number {
    const pitchToPhi = (pitch: number) => Math.PI / 2 - pitch;
    const phiMin = pitchToPhi(this.options.maxPitch);
    const phiMax = pitchToPhi(this.options.minPitch);
    return Math.max(phiMin, Math.min(phiMax, phi));
  }

  constructor(
    public readonly keyboard: KeyboardInput,
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
    this.mouseInput = new MouseInput(this.options.mouseOptions);
    this.directionsInput = new DirectionInput(keyboard, this.options.keymap);
    this.bindings = new ControllerBindings(this.options, DEFAULT_CHARACTER_GAMEPAD_BINDING, this._onRemoved$);
    // Captured before the `viewMode` setter below ever runs, so it reflects the camera's fov as the
    // app configured it, not anything this controller (or a third-person restore) already touched -
    // see `baseFov`'s own doc.
    this.baseFov = camera.camera.fov;
    // Routed through the `viewMode` setter (not just `this._viewMode = ...`) so the initial
    // `character.hideMesh`/camera render-layer state are both applied up front too, exactly as a
    // later `toggleViewMode()` call would - `_viewMode` itself hasn't been assigned yet at this
    // point, so the setter's own `this._viewMode = value` line is what establishes it here, not a
    // redundant re-assignment of an already-set field.
    this.viewMode = this.options.viewMode;
  }

  async onSpawned(world: GgWorld<any, any>): Promise<void> {
    super.onSpawned(world);
    this.reset();
    this.bindings.followKeymap(this.directionsInput, o => o.keymap);

    this.directionsInput.direction$
      .pipe(
        takeUntil(this._onRemoved$),
        filter(() => this.active),
      )
      .subscribe(direction => {
        // Local axes here follow `CharacterController3dEntity.moveDirection`'s own convention (see
        // its doc): local +Y is "forward at zero yaw", local +X is "right at zero yaw" - the same
        // right=X/forward=Y/up=Z axis paradigm `RaycastVehicle3dEntity`/`GgCarEntity` use (see e.g.
        // `AmmoRaycastVehicleComponent`'s `setCoordinateSystem(0, 2, 1)`), NOT the camera/
        // `FreeCameraController` convention (local -Z forward, local Y up), which does not apply here
        // since the character's identity/rest orientation stands with its long axis along `up` (Z),
        // not along local Y like a camera's.
        const local: MutablePoint3 = { x: direction.x, y: direction.y, z: 0 };
        if (this.character) {
          this.character.moveDirection = local;
        }
      });

    this.bindings
      .followKey(this.keyboard, o => o.jumpKey)
      .pipe(
        takeUntil(this._onRemoved$),
        filter(down => this.active && down),
      )
      .subscribe(() => this.character?.jump());

    this.bindings
      .followKey(this.keyboard, o => o.runKey)
      .pipe(
        takeUntil(this._onRemoved$),
        filter(() => this.active),
      )
      .subscribe(down => {
        if (this.character) {
          this.character.isRunning = down;
        }
      });

    this.bindings
      .followKey(this.keyboard, o => o.crouchKey)
      .pipe(
        takeUntil(this._onRemoved$),
        filter(() => this.active),
      )
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

    this.bindings
      .followKey(this.keyboard, o => o.toggleViewKey)
      .pipe(
        takeUntil(this._onRemoved$),
        filter(down => this.active && down),
      )
      .subscribe(() => this.toggleViewMode());

    const isTouchScreen = MouseInput.isTouchDevice();
    this.mouseInput.delta$
      .pipe(
        takeUntil(this._onRemoved$),
        filter(
          () =>
            this.active &&
            (isTouchScreen || !this.options.ignoreMouseUnlessPointerLocked || this.mouseInput.isPointerLocked),
        ),
      )
      .subscribe(delta => {
        this._spherical.theta -= (delta.x * this.options.mouseSensitivity) / 1000;
        this._spherical.phi = this.clampPitch(this._spherical.phi + (delta.y * this.options.mouseSensitivity) / 1000);
      });

    const gamepadInput = world.gamepadInput;
    if (gamepadInput) {
      this.bindings.followGamepadKey(
        gamepadInput,
        this.keyboard,
        o => o.jumpKey,
        g => g.jump,
      );
      this.bindings.followGamepadKey(
        gamepadInput,
        this.keyboard,
        o => o.runKey,
        g => g.run,
      );
      this.bindings.followGamepadKey(
        gamepadInput,
        this.keyboard,
        o => o.crouchKey,
        g => g.crouch,
      );
      this.bindings.followGamepadKey(
        gamepadInput,
        this.keyboard,
        o => o.toggleViewKey,
        g => g.toggleView,
      );
      this.bindings.followGamepadDirection(gamepadInput, this.directionsInput, g => g.move);
    }

    this.tick$
      .pipe(
        takeUntil(this._onRemoved$),
        filter(() => this.active),
      )
      .subscribe(([, delta]) => {
        const gamepad = this.options.gamepad;
        if (gamepad && gamepadInput && this.directionsInput.running) {
          // the stick turns the view at a rate, so it is applied per tick, scaled by the tick's
          // time; straight onto the look state, since the mouse path may wait for pointer lock
          const look = gamepadInput.direction(gamepad.look);
          if (look.x !== 0 || look.y !== 0) {
            const angle = (gamepad.lookSpeed * delta) / 1000;
            this._spherical.theta -= look.x * angle;
            this._spherical.phi = this.clampPitch(this._spherical.phi - look.y * angle);
          }
        }
        this.updateCamera();
      });

    runWhileInputEnabled(
      world,
      this._onRemoved$,
      () => {
        this.mouseInput.start();
        this.directionsInput.start();
      },
      () => {
        this.mouseInput.stop(true);
        this.directionsInput.stop();
      },
    );
  }

  async onRemoved(): Promise<void> {
    await super.onRemoved();
    await this.mouseInput.stop(true);
    await this.directionsInput.stop();
  }

  private updateCamera(): void {
    const lookDir = Pnt3.fromSpherical(this._spherical);
    const up = this.character?.characterController.up ?? Pnt3.Z;

    if (this.character) {
      // Pure rotation around `up` by the current yaw angle - NOT `Qtrn.lookAt`. `lookAt` builds a
      // camera-style basis (local -Z forward, local Y up) and is correct for `this.camera` below,
      // but the character's capsule mesh/shape has its long axis along local Z at rest (identity
      // rotation) - applying a camera-style basis to it would tip the capsule onto its side (its
      // local Z, the long axis, would end up pointing along whatever direction the lookAt basis's
      // local Z maps to, which is horizontal). A plain axis-angle rotation around `up` leaves `up`
      // itself fixed, so the capsule always stays upright regardless of yaw - see
      // `CharacterController3dEntity.moveDirection`'s doc for the matching local-axis convention.
      //
      // `theta` is measured from `Pnt3.fromSpherical`'s own convention (`theta == 0` faces world
      // +X), but this character's local "forward" is +Y, not +X (see `moveDirection`'s doc) - so
      // the yaw angle applied here is offset by -90° from `theta` itself: rotating local +Y by
      // `theta - PI/2` around `up` lands exactly on `fromSpherical(theta)`, i.e. the same direction
      // `lookDir`/the camera itself is facing (horizontally).
      this.character.rotation = Qtrn.fromAngle(up, this._spherical.theta - Math.PI / 2);
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
        // `target` sits on the character's own capsule centerline - raycasting from it straight out
        // (`RaycastOptions` has no per-call "exclude this body" hook, and the character's collision
        // group is not, by default, distinct from ordinary level geometry's) immediately reports a
        // self-hit at ~0 distance, collapsing the third-person camera onto `target` every tick -
        // indistinguishable from first-person (regression, found live in a third-person rapier3d
        // scene: `V` correctly flipped `viewMode` to `'third-person'`, but the camera stayed glued
        // to the character's own head position instead of pulling back). Nudge the ray's start point
        // outward past the capsule's own geometry along the same look direction first via
        // `characterControllerSelfHitSkip()` (see its own doc - `ObjectGrabController.tryGrab()` uses
        // the same helper for the identical problem), then add that offset back onto the measured hit
        // distance so it's still relative to `target`, not the nudged start point.
        const startOffset = characterControllerSelfHitSkip(
          target,
          Pnt3.neg(lookDir),
          this.character.position,
          up,
          this.character.characterController.radius,
          this.character.characterController.centersDistance,
          this.options.thirdPersonDistance,
        );
        const rayStart = Pnt3.sub(target, Pnt3.scalarMult(lookDir, startOffset));
        const desired = Pnt3.sub(target, Pnt3.scalarMult(lookDir, distance));
        const result = this.character.world.physicsWorld.raycast({ from: rayStart, to: desired });
        if (result.hasHit && result.hitDistance !== undefined) {
          distance = Math.max(0, startOffset + result.hitDistance - this.options.cameraCollisionMargin);
        }
      }
      this.camera.position = Pnt3.sub(target, Pnt3.scalarMult(lookDir, distance));
    }
    this.camera.rotation = Qtrn.lookAt(this.camera.position, Pnt3.add(this.camera.position, lookDir));
  }
}
