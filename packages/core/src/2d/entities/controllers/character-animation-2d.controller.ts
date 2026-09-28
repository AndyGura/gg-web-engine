import { takeUntil } from 'rxjs';
import { IEntity, TickOrder } from '../../../base';
import { Gg2dWorld, Gg2dWorldTypeDocRepo } from '../../gg-2d-world';
import { CharacterController2dEntity } from '../character-controller-2d.entity';
import { isAnimatedDisplayObject2d } from '../../components/rendering/i-animated-display-object-2d.component';

/**
 * Built-in movement states a `CharacterAnimation2dController` distinguishes - the atlas-clip
 * counterpart of `CharacterAnimationState`, minus `'crouch'` (`CharacterController2dEntity` has no
 * crouch state - see its own doc for why).
 */
export type CharacterAnimation2dState = 'idle' | 'walk' | 'run' | 'jump';

/**
 * Maps a {@link CharacterAnimation2dState} to the animation clip name inside the character's own
 * atlas that should play for it. A state missing from the map (or whose resolved name isn't
 * actually one of the sprite's `animationNames`) is simply never switched into - the controller
 * keeps whatever was last playing rather than switching to nothing.
 */
export type CharacterAnimation2dClipMap = Partial<Record<CharacterAnimation2dState, string>>;

/** `CharacterAnimation2dClipMap` fallback used for any state not given an explicit entry - the
 * state's own name, so an atlas whose clips happen to already be named `"idle"`/`"walk"`/`"run"`/
 * `"jump"` needs no mapping at all. */
const DEFAULT_CLIP_MAP: Required<CharacterAnimation2dClipMap> = {
  idle: 'idle',
  walk: 'walk',
  run: 'run',
  jump: 'jump',
};

export type CharacterAnimation2dControllerOptions = {
  /** Overrides `DEFAULT_CLIP_MAP` per state - see {@link CharacterAnimation2dClipMap}. */
  clipMap: CharacterAnimation2dClipMap;
  /** Minimum `Math.abs(character.moveDirection)` that counts as "trying to move" (vs. idle).
   * Default 0.01. */
  movementEpsilon: number;
  /**
   * Minimum time (seconds) `character.isGrounded`'s *raw* reading must hold steady at a new value
   * before the animation state machine actually trusts it - see `CharacterAnimationController`'s
   * own doc for why this exists at all (identical rationale, just in 2D). `0` disables debouncing
   * entirely. Default 0.15.
   */
  groundedTransitionDelay: number;
  /**
   * Whether to flip the sprite horizontally (`object2D.scale.x`'s sign, via
   * `IDisplayObject2dComponent`) to match `character.facing`. Default `true`. Set `false` if the
   * atlas already draws separate left/right-facing frames (or the app wants to control facing
   * itself).
   */
  flipSpriteToFacing: boolean;
};

const DEFAULT_OPTIONS: CharacterAnimation2dControllerOptions = {
  clipMap: {},
  movementEpsilon: 0.01,
  groundedTransitionDelay: 0.15,
  flipSpriteToFacing: true,
};

/**
 * Drives a `CharacterController2dEntity`'s animated sprite (see `IAnimatedDisplayObject2dComponent`)
 * by picking a {@link CharacterAnimation2dState} from the character's own public movement state each
 * tick - `isGrounded`, `isRunning`, `moveDirection` - and calling `playAnimation` whenever that state
 * changes, plus `updateAnimations` every tick regardless (to advance the underlying clip's frame
 * timer). A no-op entity (still ticks, does nothing) if `character.object2D` isn't an animated
 * display object at the time of the check. Mirrors `CharacterAnimationController` (the 3D
 * counterpart) closely - see that class's own doc for the full grounded-debounce rationale, which
 * applies identically here.
 *
 * Ticks at `TickOrder.ANIMATION_MIXERS`, deliberately *after* `character`'s own tick (`TickOrder
 * .PHYSICS_SIMULATION - 5`, pre-physics) and after `Entity2d`'s `OBJECTS_BINDING` sprite-position
 * sync (400) - both physics simulation and this frame's position sync have already happened by
 * then.
 */
export class CharacterAnimation2dController<
  TypeDoc extends Gg2dWorldTypeDocRepo = Gg2dWorldTypeDocRepo,
> extends IEntity {
  static readonly entityTypeName: string = 'CharacterAnimation2dController';
  public readonly tickOrder = TickOrder.ANIMATION_MIXERS;

  public readonly options: CharacterAnimation2dControllerOptions;

  private _currentState: CharacterAnimation2dState | null = null;

  private _debouncedGrounded: boolean | null = null;
  private _pendingGrounded: boolean | null = null;
  private _pendingGroundedElapsed: number = 0;

  constructor(
    protected readonly character: CharacterController2dEntity<TypeDoc>,
    options: Partial<CharacterAnimation2dControllerOptions> = {},
  ) {
    super();
    this.options = { ...DEFAULT_OPTIONS, ...options, clipMap: { ...DEFAULT_OPTIONS.clipMap, ...options.clipMap } };
  }

  onSpawned(world: Gg2dWorld<TypeDoc>): void {
    super.onSpawned(world);
    this.tick$.pipe(takeUntil(this._onRemoved$)).subscribe(([, delta]) => this.update(delta / 1000));
  }

  /**
   * Resolves the character's current movement state to one of the built-in
   * {@link CharacterAnimation2dState}s. Airborne takes priority over walking/running, which takes
   * priority over idle. Reads `_debouncedGrounded`, not `character.isGrounded` directly - see this
   * class's own doc for why.
   */
  protected resolveState(): CharacterAnimation2dState {
    if (!this._debouncedGrounded) {
      return 'jump';
    }
    if (Math.abs(this.character.moveDirection) <= this.options.movementEpsilon) {
      return 'idle';
    }
    return this.character.isRunning ? 'run' : 'walk';
  }

  private updateGroundedDebounce(deltaSeconds: number): void {
    const raw = this.character.isGrounded;
    if (this._debouncedGrounded === null) {
      this._debouncedGrounded = raw;
      return;
    }
    if (raw === this._debouncedGrounded) {
      this._pendingGrounded = null;
      this._pendingGroundedElapsed = 0;
      return;
    }
    if (this._pendingGrounded !== raw) {
      this._pendingGrounded = raw;
      this._pendingGroundedElapsed = 0;
    }
    this._pendingGroundedElapsed += deltaSeconds;
    if (this._pendingGroundedElapsed >= this.options.groundedTransitionDelay) {
      this._debouncedGrounded = raw;
      this._pendingGrounded = null;
      this._pendingGroundedElapsed = 0;
    }
  }

  private update(deltaSeconds: number): void {
    this.updateGroundedDebounce(deltaSeconds);
    const object2D = this.character.object2D;

    if (this.options.flipSpriteToFacing && object2D) {
      const sign = this.character.facing;
      const scale = object2D.scale;
      object2D.scale = { x: Math.abs(scale.x) * sign, y: scale.y };
    }

    if (!isAnimatedDisplayObject2d(object2D)) {
      return;
    }
    object2D.updateAnimations(deltaSeconds);

    const state = this.resolveState();
    if (state === this._currentState) {
      return;
    }
    const clipName = this.options.clipMap[state] ?? DEFAULT_CLIP_MAP[state];
    if (!object2D.animationNames.includes(clipName)) {
      return;
    }
    object2D.playAnimation(clipName);
    this._currentState = state;
  }

  dispose(): void {
    super.dispose();
    this.tick$.complete();
  }
}
