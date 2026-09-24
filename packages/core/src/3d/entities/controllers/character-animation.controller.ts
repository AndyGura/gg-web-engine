import { takeUntil } from 'rxjs';
import { IEntity, Pnt3, TickOrder } from '../../../base';
import { Gg3dWorld, Gg3dWorldTypeDocRepo } from '../../gg-3d-world';
import { CharacterController3dEntity } from '../character-controller-3d.entity';
import { isAnimatedDisplayObject3d } from '../../components/rendering/i-animated-display-object-3d.component';

/**
 * Built-in movement states a `CharacterAnimationController` distinguishes. Covers the animation
 * set called out for a player character - idle/walking/running/crouching/airborne - not an
 * open-ended state machine; an app wanting more states (e.g. a distinct landing pose, strafing)
 * drives `IAnimatedDisplayObject3dComponent.playAnimation` directly instead of going through this
 * controller.
 */
export type CharacterAnimationState = 'idle' | 'walk' | 'run' | 'crouch' | 'jump';

/**
 * Maps a {@link CharacterAnimationState} to the animation clip name inside the character's own
 * model that should play for it. A state missing from the map (or whose resolved name isn't
 * actually one of the model's `animationNames`) is simply never switched into - the controller
 * keeps whatever was last playing rather than switching to nothing.
 */
export type CharacterAnimationClipMap = Partial<Record<CharacterAnimationState, string>>;

/** `CharacterAnimationClipMap` fallback used for any state not given an explicit entry - the
 * state's own name, so a model whose clips happen to already be named `"idle"`/`"walk"`/`"run"`/
 * `"crouch"`/`"jump"` needs no mapping at all. */
const DEFAULT_CLIP_MAP: Required<CharacterAnimationClipMap> = {
  idle: 'idle',
  walk: 'walk',
  run: 'run',
  crouch: 'crouch',
  jump: 'jump',
};

export type CharacterAnimationControllerOptions = {
  /** Overrides `DEFAULT_CLIP_MAP` per state - see {@link CharacterAnimationClipMap}. */
  clipMap: CharacterAnimationClipMap;
  /** Crossfade duration (seconds) applied on every state switch. Default 0.2. */
  fadeDuration: number;
  /** Minimum `Pnt3.len(character.moveDirection)` that counts as "trying to move" (vs. idle).
   * Default 0.01 - just above float noise, since `moveDirection` is normally either exactly zero
   * or a unit-ish vector from an input driver, never a small nonzero value by accident. */
  movementEpsilon: number;
  /**
   * Minimum time (seconds) `character.isGrounded`'s *raw* reading must hold steady at a new value
   * before the animation state machine actually trusts it - see this class's own doc for why this
   * exists at all. `0` disables debouncing entirely (every raw flip is trusted immediately, the
   * pre-debounce behavior). Default 0.15.
   */
  groundedTransitionDelay: number;
};

const DEFAULT_OPTIONS: CharacterAnimationControllerOptions = {
  clipMap: {},
  fadeDuration: 0.2,
  movementEpsilon: 0.01,
  groundedTransitionDelay: 0.15,
};

/**
 * Drives a `CharacterController3dEntity`'s animated model (see `IAnimatedDisplayObject3dComponent`)
 * by picking a {@link CharacterAnimationState} from the character's own public movement state each
 * tick - `isGrounded`, `isCrouching`, `isRunning`, `moveDirection` - and calling `playAnimation`
 * whenever that state changes, plus `updateAnimations` every tick regardless (to advance the
 * underlying clip time). A no-op entity (still ticks, does nothing) if `character.object3D` isn't
 * an animated display object at the time of the check - e.g. a physics-only/invisible character, or
 * one using the auto-generated capsule mesh instead of a loaded model - so it's always safe to
 * attach one speculatively rather than checking first.
 *
 * Ticks at `TickOrder.ANIMATION_MIXERS`, deliberately *after* `character`'s own tick (`TickOrder
 * .PHYSICS_SIMULATION - 5`, pre-physics) and after `Entity3d`'s `OBJECTS_BINDING` mesh-position sync
 * (400) - both physics simulation and this frame's position/rotation sync have already happened by
 * then, so `character.isGrounded` and friends reflect this frame's actual result rather than last
 * frame's, and the model's own transform is already in its final place for whatever rendering does
 * next. Mirrors `PlayerCharacterController` driving `CharacterController3dEntity`, and
 * `ObjectGrabController` driving `Grabbable3dEntity`, in shape - a separate controller entity
 * reading/reacting to another entity's state, rather than folding this into
 * `CharacterController3dEntity` itself (which ticks pre-physics and has no notion of animation) -
 * see `gg-engine-core-development`'s `tickOrder` section for why this split is the established
 * pattern here.
 *
 * Not tied to level JSON: construct and `world.addEntity`/`character.addChildren` one directly for
 * a programmatically-built character too. The built-in `"Player"` level class does exactly this
 * itself (see `Player3DSettings.display.model`) whenever a model with animations is configured, so
 * a level-JSON player gets this wiring for free with no app code needed.
 *
 * `character.isGrounded` is a raw per-tick physics reading, not a stable/hysteresis-free signal -
 * standing right at the edge of a platform (or any other borderline-contact position) can make an
 * adapter's own sweep/overlap check flip it true/false tick to tick with no actual movement
 * involved, which would otherwise make `resolveState()` flicker the animation between `'jump'` and
 * whatever grounded state applies (`'idle'`/`'walk'`/`'run'`/`'crouch'`) every single tick - visibly
 * distracting, and not something any adapter-level fix can resolve (it's inherent to sampling a
 * boundary condition every tick, not a bug in one particular adapter's sweep). This class debounces
 * that raw signal itself (see `groundedTransitionDelay`) before `resolveState()` ever sees it,
 * rather than debouncing the resolved animation state - debouncing the state instead would equally
 * suppress a *deliberate* rapid state change (e.g. running straight off a ledge into open air,
 * which should read as airborne the instant it happens, not `groundedTransitionDelay` later) purely
 * because grounded-ness happened to be involved, which isn't the actual problem being solved.
 */
export class CharacterAnimationController<TypeDoc extends Gg3dWorldTypeDocRepo = Gg3dWorldTypeDocRepo> extends IEntity {
  static readonly entityTypeName: string = 'CharacterAnimationController';
  public readonly tickOrder = TickOrder.ANIMATION_MIXERS;

  public readonly options: CharacterAnimationControllerOptions;

  private _currentState: CharacterAnimationState | null = null;

  /** Debounced `character.isGrounded` reading `resolveState()` actually uses - see this class's own
   * doc and {@link updateGroundedDebounce}. `null` until the first tick, which always adopts the
   * raw value immediately (nothing to debounce against yet). */
  private _debouncedGrounded: boolean | null = null;
  /** The raw value currently being timed as a candidate to replace `_debouncedGrounded`, or `null`
   * while the raw reading agrees with `_debouncedGrounded` (nothing pending). */
  private _pendingGrounded: boolean | null = null;
  /** How long `_pendingGrounded` has held steady so far, in seconds. Reset to `0` any time the raw
   * reading changes again before reaching `groundedTransitionDelay` - a flip back within the
   * debounce window doesn't count as having "survived" it. */
  private _pendingGroundedElapsed: number = 0;

  constructor(
    protected readonly character: CharacterController3dEntity<TypeDoc>,
    options: Partial<CharacterAnimationControllerOptions> = {},
  ) {
    super();
    this.options = { ...DEFAULT_OPTIONS, ...options, clipMap: { ...DEFAULT_OPTIONS.clipMap, ...options.clipMap } };
  }

  onSpawned(world: Gg3dWorld<TypeDoc>): void {
    super.onSpawned(world);
    this.tick$.pipe(takeUntil(this._onRemoved$)).subscribe(([, delta]) => this.update(delta / 1000));
  }

  /**
   * Resolves the character's current movement state to one of the built-in
   * {@link CharacterAnimationState}s. Airborne takes priority over crouching (a character can't be
   * both at once anyway, since `CharacterController3dEntity.tryStandUp` only runs while grounded),
   * which takes priority over walking/running, which takes priority over idle. Reads
   * `_debouncedGrounded`, not `character.isGrounded` directly - see this class's own doc for why.
   */
  protected resolveState(): CharacterAnimationState {
    if (!this._debouncedGrounded) {
      return 'jump';
    }
    if (this.character.isCrouching) {
      return 'crouch';
    }
    if (Pnt3.len(this.character.moveDirection) <= this.options.movementEpsilon) {
      return 'idle';
    }
    return this.character.isRunning ? 'run' : 'walk';
  }

  /**
   * Updates {@link _debouncedGrounded} from `character.isGrounded`'s raw reading this tick. The
   * first call ever always adopts the raw value immediately (there's no prior committed state to
   * protect yet - the "just spawned already mid-air" case shouldn't wait out the debounce window
   * before showing an airborne pose). After that, a raw value that disagrees with the currently
   * committed one only replaces it once it's held steady for `groundedTransitionDelay` seconds
   * straight - a flip back to the committed value at any point before then restarts the timer from
   * `0` rather than carrying over partial progress, so a rapid back-and-forth (the flicker this
   * exists to suppress) never accumulates enough steady time to commit either value.
   */
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
    const object3D = this.character.object3D;
    if (!isAnimatedDisplayObject3d(object3D)) {
      return;
    }
    object3D.updateAnimations(deltaSeconds);

    const state = this.resolveState();
    if (state === this._currentState) {
      return;
    }
    const clipName = this.options.clipMap[state] ?? DEFAULT_CLIP_MAP[state];
    if (!object3D.animationNames.includes(clipName)) {
      return;
    }
    object3D.playAnimation(clipName, { fadeDuration: this.options.fadeDuration });
    this._currentState = state;
  }

  dispose(): void {
    super.dispose();
    this.tick$.complete();
  }
}
