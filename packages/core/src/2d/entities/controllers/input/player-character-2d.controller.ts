import { filter, takeUntil } from 'rxjs';
import {
  DirectionInput,
  DirectionKeymap,
  IEntity,
  KeyboardInput,
  Pnt2,
  runWhileInputEnabled,
  TickOrder,
} from '../../../../base';
import { Renderer2dEntity } from '../../renderer-2d.entity';
import { CharacterController2dEntity } from '../../character-controller-2d.entity';
import { Gg2dWorld, Gg2dWorldTypeDocRepo } from '../../../gg-2d-world';

/**
 * Options for configuring a `PlayerCharacterController2d`.
 */
export type PlayerCharacterController2dOptions = {
  /** Keymap for left/right movement. `'wasd+arrows'` by default (both layouts work at once). */
  keymap: DirectionKeymap;
  /** Key code that triggers `character.jump()`. `'Space'` by default. */
  jumpKey: string;
  /** Key code that sets `character.isRunning`. `'ShiftLeft'` by default. */
  runKey: string;
  /** Key code that drives `character.isCrouching`, per `character.options.crouchMode`. `'ControlLeft'` by default. */
  crouchKey: string;
  /**
   * How far ahead of the character (along its `facing`) the camera's look target is offset, in
   * world units - a fixed lead so the player can see more of what's ahead than what's behind.
   * Default 0.
   */
  lookAheadDistance: number;
  /** How quickly the camera catches up to its target position: the fraction of the remaining
   * distance closed per 1/60 s (0..1, exponential smoothing, the same at any frame rate - `1` snaps
   * instantly). Default 0.1. */
  cameraSmoothing: number;
};

const DEFAULT_OPTIONS: PlayerCharacterController2dOptions = {
  keymap: 'wasd+arrows',
  jumpKey: 'Space',
  runKey: 'ShiftLeft',
  crouchKey: 'ControlLeft',
  lookAheadDistance: 0,
  cameraSmoothing: 0.1,
};

/**
 * The player's input+camera controller for a 2D platformer character: left/right/sprint/crouch/jump
 * keys driving a plain `CharacterController2dEntity` (which owns the actual movement/gravity/jump/
 * crouch physics), plus a simple side-scroller camera that follows the character's position with
 * exponential smoothing. Mirrors `PlayerCharacterController` (the 3D counterpart) in shape, without
 * mouse-look/view-mode switching - a 2D side view has no such concept (see
 * `CharacterController2dEntity`'s own doc for why `moveDirection` is a scalar, not a look-relative
 * vector).
 *
 * @example
 * ```ts
 * import { CharacterController2dEntity, Pnt2, PlayerCharacterController2d } from '@gg-web-engine/core';
 *
 * // sizes and speeds in pixels; screen Y points down, so "up" is -Y
 * const character = new CharacterController2dEntity(
 *   { radius: 20, centersDistance: 40, walkSpeed: 260, jumpSpeed: 780, gravity: 2000 },
 *   world.visualScene.factory.createCapsule(20, 40, { color: 0x3388ff }),
 *   world.physicsWorld.factory.createCharacterController(
 *     { radius: 20, centersDistance: 40, up: Pnt2.nY },
 *     { position: { x: 0, y: 100 } },
 *   ),
 * );
 * world.addEntity(character);
 *
 * const renderer = world.addRenderer(world.visualScene.factory.createCamera(), canvas);
 * world.addEntity(
 *   new PlayerCharacterController2d(world.keyboardInput, character, renderer, { lookAheadDistance: 120 }),
 * );
 * ```
 */
export class PlayerCharacterController2d<TypeDoc extends Gg2dWorldTypeDocRepo = Gg2dWorldTypeDocRepo> extends IEntity {
  static readonly entityTypeName: string = 'PlayerCharacterController2d';
  public readonly tickOrder = TickOrder.CONTROLLERS;

  public readonly options: PlayerCharacterController2dOptions;

  public readonly directionsInput: DirectionInput;

  get active(): boolean {
    return super.active;
  }

  set active(value: boolean) {
    const wasActive = super.active;
    if (wasActive && !value) {
      // Neutralize whatever this controller last wrote to `character` so a deactivated controller
      // leaves it in a resting state instead of "stuck" mid-input (e.g. still walking forever if
      // `active` is set to `false` while a direction key is held down) - see the subscriptions
      // below, all now gated on `this.active` too so they stop writing anything further.
      if (this.character) {
        this.character.moveDirection = 0;
        this.character.isRunning = false;
        if (this.character.options.crouchMode === 'hold') {
          this.character.isCrouching = false;
        }
      }
    }
    super.active = value;
  }

  constructor(
    public readonly keyboard: KeyboardInput,
    /** The character this controller drives. May be swapped/set to `null` at any time. */
    public character: CharacterController2dEntity<TypeDoc> | null,
    protected readonly camera: Renderer2dEntity<TypeDoc['vTypeDoc']>,
    options: Partial<PlayerCharacterController2dOptions> = {},
  ) {
    super();
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.directionsInput = new DirectionInput(keyboard, this.options.keymap);
  }

  async onSpawned(world: Gg2dWorld<TypeDoc>): Promise<void> {
    super.onSpawned(world);

    this.directionsInput.direction$
      .pipe(
        takeUntil(this._onRemoved$),
        filter(() => this.active),
      )
      .subscribe(direction => {
        // `direction.x` is positive to the right, the same as this character's `moveDirection` (see
        // `CharacterController2dEntity`'s doc)
        if (this.character) {
          this.character.moveDirection = direction.x;
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
      .pipe(
        takeUntil(this._onRemoved$),
        filter(() => this.active),
      )
      .subscribe(down => {
        if (this.character) {
          this.character.isRunning = down;
        }
      });

    this.keyboard
      .bind(this.options.crouchKey)
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

    this.tick$
      .pipe(
        takeUntil(this._onRemoved$),
        filter(() => this.active),
      )
      .subscribe(([, delta]) => this.updateCamera(delta / 1000));

    runWhileInputEnabled(
      world,
      this._onRemoved$,
      () => this.directionsInput.start(),
      () => this.directionsInput.stop(),
    );
  }

  async onRemoved(): Promise<void> {
    await super.onRemoved();
    await this.directionsInput.stop();
  }

  private updateCamera(dt: number): void {
    if (!this.character) {
      return;
    }
    const right = Pnt2.rot(this.character.characterController.up, Math.PI / 2);
    const target = Pnt2.add(
      this.character.position,
      Pnt2.scalarMult(right, this.options.lookAheadDistance * this.character.facing),
    );
    const smoothing = this.options.cameraSmoothing;
    const t = smoothing <= 0 || smoothing >= 1 ? 1 : 1 - Math.pow(1 - smoothing, dt * 60);
    this.camera.position = Pnt2.lerp(this.camera.position, target, t);
  }
}
