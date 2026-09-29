---
title: core/2d/components/rendering/i-animated-display-object-2d.component.ts
nav_order: 18
parent: Modules
---

## i-animated-display-object-2d.component overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [IAnimatedDisplayObject2dComponent (interface)](#ianimateddisplayobject2dcomponent-interface)
  - [PlayAnimation2dOptions (interface)](#playanimation2doptions-interface)
  - [isAnimatedDisplayObject2d](#isanimateddisplayobject2d)

---

# utils

## IAnimatedDisplayObject2dComponent (interface)

A 2D display object that also carries a frame-based sprite animation (e.g. an atlas-backed
`AnimatedSprite` built from a texture atlas's named frame sequences), as opposed to a
single-texture/auto-generated primitive (box, capsule, ...) which never implements this. Optional/
adapter-specific on purpose - see `IAnimatedDisplayObject3dComponent`'s doc, which this mirrors
exactly (just for a 2D atlas-frame clip instead of a 3D skeletal/keyframe one): check with
{@link isAnimatedDisplayObject2d} before calling into it.

A driver (e.g. `CharacterAnimation2dController`) is expected to call {@link updateAnimations}
once per tick with the frame's own delta time, and {@link playAnimation}/{@link stopAnimation}
only when the desired clip actually changes.

**Signature**

```ts
export interface IAnimatedDisplayObject2dComponent<VTypeDoc extends VisualTypeDocRepo2D = VisualTypeDocRepo2D>
  extends IDisplayObject2dComponent<VTypeDoc> {
  /** Names of every animation clip available on this sprite, as authored in the source atlas. */
  readonly animationNames: string[]

  /** The clip name last passed to {@link playAnimation}, or `null` if none has played yet (or
   * {@link stopAnimation} was called since). */
  readonly currentAnimationName: string | null

  /**
   * Plays the named clip. A no-op (with a `warnOnce` warning) if `name` isn't one of
   * {@link animationNames}. Calling this again with the same `name` already playing is a no-op - it
   * does not restart/pop the clip. `fadeDuration` on `options` is accepted for interface parity with
   * `IAnimatedDisplayObject3dComponent` but a discrete frame-atlas clip has nothing to crossfade
   * between (no blend tree the way a skeletal rig has) - an implementation is free to ignore it.
   */
  playAnimation(name: string, options?: PlayAnimation2dOptions): void

  /** Stops whatever clip is currently playing, leaving the sprite on its last posed frame. A no-op
   * if nothing is currently playing. */
  stopAnimation(fadeDuration?: number): void

  /** Advances the currently playing clip by `deltaSeconds` - must be called once per tick for
   * animation to progress at all (nothing here ticks itself). */
  updateAnimations(deltaSeconds: number): void
}
```

## PlayAnimation2dOptions (interface)

Options for {@link IAnimatedDisplayObject2dComponent.playAnimation}. Mirrors
`PlayAnimationOptions` (the 3D/skeletal-animation counterpart) field-for-field, kept as a
separate type so `packages/core`'s 2D module doesn't reach into its 3D module for a type that
happens to look the same today.

**Signature**

```ts
export interface PlayAnimation2dOptions {
  /** Whether the clip repeats indefinitely once it reaches its end, vs. playing once and holding
   * its last frame. Default `true`. */
  loop?: boolean
  /** Crossfade duration (seconds) - accepted for interface parity with the 3D counterpart, but a
   * discrete frame-atlas clip has nothing to blend between; an implementation is free to ignore
   * it. See {@link IAnimatedDisplayObject2dComponent.playAnimation}'s doc. */
  fadeDuration?: number
  /** Playback speed multiplier applied to the clip's own authored frame rate. Default `1`. */
  timeScale?: number
}
```

## isAnimatedDisplayObject2d

Type guard for {@link IAnimatedDisplayObject2dComponent} - mirrors
`isAnimatedDisplayObject3d`'s doc.

**Signature**

```ts
export declare function isAnimatedDisplayObject2d<VTypeDoc extends VisualTypeDocRepo2D = VisualTypeDocRepo2D>(
  displayObject: VTypeDoc['displayObject'] | null | undefined
): displayObject is IAnimatedDisplayObject2dComponent<VTypeDoc>
```
