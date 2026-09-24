import { IDisplayObject3dComponent } from './i-display-object-3d.component';
import { VisualTypeDocRepo3D } from '../../gg-3d-world';

/**
 * Options for {@link IAnimatedDisplayObject3dComponent.playAnimation}.
 */
export interface PlayAnimationOptions {
  /** Whether the clip repeats indefinitely once it reaches its end, vs. playing once and holding
   * its last frame. Default `true`. */
  loop?: boolean;
  /** Crossfade duration (seconds) blending out whichever clip was previously playing into this
   * one, so a state switch (e.g. walk -> run) doesn't visibly pop. `0` swaps instantly. Default
   * `0.2`. */
  fadeDuration?: number;
  /** Playback speed multiplier applied to the clip's own authored timing. Default `1`. */
  timeScale?: number;
}

/**
 * A 3D display object that also carries a skeletal/keyframe animation rig - e.g. a glTF/GLB model
 * loaded with bones and `AnimationClip`s (see `IDisplayObject3dComponentLoader.loadFromGlb`), as
 * opposed to an auto-generated primitive mesh (box, capsule, ...) which never implements this.
 * Optional/adapter-specific on purpose: most display objects (primitives, static props) have
 * nothing to animate, so this isn't part of the base `IDisplayObject3dComponent` contract at all -
 * check with {@link isAnimatedDisplayObject3d} before calling into it, the same way an app checks
 * for any other optional capability on a value it only knows generically.
 *
 * A driver (e.g. `CharacterAnimationController`) is expected to call {@link updateAnimations}
 * once per tick with the frame's own delta time, and {@link playAnimation}/{@link stopAnimation}
 * only when the desired clip actually changes - see `CharacterAnimationController`'s own doc for
 * the established `TickOrder.ANIMATION_MIXERS` timing this assumes (after a mesh's position/
 * rotation has already been synced from its driving body/controller this frame, before rendering).
 */
export interface IAnimatedDisplayObject3dComponent<
  VTypeDoc extends VisualTypeDocRepo3D = VisualTypeDocRepo3D,
> extends IDisplayObject3dComponent<VTypeDoc> {
  /** Names of every animation clip available on this model, as authored in the source asset. */
  readonly animationNames: string[];

  /** The clip name last passed to {@link playAnimation}, or `null` if none has played yet (or
   * {@link stopAnimation} was called since). */
  readonly currentAnimationName: string | null;

  /**
   * Plays the named clip, crossfading from whatever was playing before (if anything). A no-op
   * (with a `warnOnce` warning) if `name` isn't one of {@link animationNames}. Calling this again
   * with the same `name` already playing is a no-op - it does not restart/pop the clip.
   */
  playAnimation(name: string, options?: PlayAnimationOptions): void;

  /** Fades out and stops whatever clip is currently playing, leaving the model in its last posed
   * frame. A no-op if nothing is currently playing. */
  stopAnimation(fadeDuration?: number): void;

  /** Advances every active/fading animation action by `deltaSeconds` - must be called once per
   * tick for animation to progress at all (nothing here ticks itself). */
  updateAnimations(deltaSeconds: number): void;
}

/**
 * Type guard for {@link IAnimatedDisplayObject3dComponent} - checks for the two methods that
 * distinguish an animated display object from an ordinary one, since the capability is optional
 * and adapter-specific (see that interface's own doc). Prefer this over an `instanceof` check
 * against any concrete adapter class, which would defeat the point of the `TypeDoc`-generic,
 * library-agnostic interfaces the rest of `packages/core` is built around.
 */
export function isAnimatedDisplayObject3d<VTypeDoc extends VisualTypeDocRepo3D = VisualTypeDocRepo3D>(
  displayObject: VTypeDoc['displayObject'] | null | undefined,
): displayObject is IAnimatedDisplayObject3dComponent<VTypeDoc> {
  return (
    !!displayObject &&
    typeof (displayObject as Partial<IAnimatedDisplayObject3dComponent<VTypeDoc>>).playAnimation === 'function' &&
    typeof (displayObject as Partial<IAnimatedDisplayObject3dComponent<VTypeDoc>>).updateAnimations === 'function'
  );
}
