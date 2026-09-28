import { filter, takeUntil } from 'rxjs';
import {
  DirectionKeyboardInput,
  DirectionKeyboardKeymap,
  IEntity,
  KeyboardInput,
  Pnt2,
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
  keymap: DirectionKeyboardKeymap;
  /** Key code that triggers `character.jump()`. `'Space'` by default. */
  jumpKey: string;
  /** Key code that sets `character.isRunning`. `'ShiftLeft'` by default. */
  runKey: string;
  /**
   * How far ahead of the character (along its `facing`) the camera's look target is offset, in
   * world units - a fixed lead so the player can see more of what's ahead than what's behind.
   * Default 0.
   */
  lookAheadDistance: number;
  /** How quickly the camera catches up to its target position, as a fraction closed per second
   * (0..1 per tick, exponential smoothing - `1` snaps instantly). Default 0.1. */
  cameraSmoothing: number;
};

const DEFAULT_OPTIONS: PlayerCharacterController2dOptions = {
  keymap: 'wasd+arrows',
  jumpKey: 'Space',
  runKey: 'ShiftLeft',
  lookAheadDistance: 0,
  cameraSmoothing: 0.1,
};

/**
 * The player's input+camera controller for a 2D platformer character: left/right/sprint/jump keys
 * driving a plain `CharacterController2dEntity` (which owns the actual movement/gravity/jump
 * physics), plus a simple side-scroller camera that follows the character's position with
 * exponential smoothing. Mirrors `PlayerCharacterController` (the 3D counterpart) in shape, without
 * mouse-look/view-mode switching - a 2D side view has no such concept (see
 * `CharacterController2dEntity`'s own doc for why `moveDirection` is a scalar, not a look-relative
 * vector).
 */
export class PlayerCharacterController2d<TypeDoc extends Gg2dWorldTypeDocRepo = Gg2dWorldTypeDocRepo> extends IEntity {
  static readonly entityTypeName: string = 'PlayerCharacterController2d';
  public readonly tickOrder = TickOrder.CONTROLLERS;

  protected readonly options: PlayerCharacterController2dOptions;

  public readonly directionsInput: DirectionKeyboardInput;

  constructor(
    protected readonly keyboard: KeyboardInput,
    /** The character this controller drives. May be swapped/set to `null` at any time. */
    public character: CharacterController2dEntity<TypeDoc> | null,
    protected readonly camera: Renderer2dEntity<TypeDoc['vTypeDoc']>,
    options: Partial<PlayerCharacterController2dOptions> = {},
  ) {
    super();
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.directionsInput = new DirectionKeyboardInput(keyboard, this.options.keymap);
  }

  async onSpawned(world: Gg2dWorld<TypeDoc>): Promise<void> {
    super.onSpawned(world);

    this.directionsInput.output$.pipe(takeUntil(this._onRemoved$)).subscribe(({ leftRight }) => {
      // `leftRight === true` means the left key is held (see `DirectionKeyboardInput`'s own doc) -
      // this character's `moveDirection` is positive along `right` (see
      // `CharacterController2dEntity`'s doc), so left maps to `-1`.
      const direction = leftRight === undefined ? 0 : leftRight ? -1 : 1;
      if (this.character) {
        this.character.moveDirection = direction;
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

    this.tick$
      .pipe(
        takeUntil(this._onRemoved$),
        filter(() => this.active),
      )
      .subscribe(([, delta]) => this.updateCamera(delta / 1000));

    await this.directionsInput.start();
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
    const t = Math.min(1, this.options.cameraSmoothing <= 0 ? 1 : this.options.cameraSmoothing * 60 * dt);
    this.camera.position = Pnt2.lerp(this.camera.position, target, t);
  }
}
