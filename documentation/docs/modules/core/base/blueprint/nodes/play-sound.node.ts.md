---
title: core/base/blueprint/nodes/play-sound.node.ts
nav_order: 80
parent: Modules
---

## play-sound.node overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [PlaySoundBlueprintNode (class)](#playsoundblueprintnode-class)
    - [trigger (method)](#trigger-method)
    - [resolvePayloadPosition (method)](#resolvepayloadposition-method)
    - [resolvePayloadImpulse (method)](#resolvepayloadimpulse-method)
    - [pickImpactTier (method)](#pickimpacttier-method)
    - [inputs (property)](#inputs-property)
    - [outputs (property)](#outputs-property)
  - [PlaySoundImpactTier (interface)](#playsoundimpacttier-interface)
  - [PlaySoundNodeSettings (interface)](#playsoundnodesettings-interface)

---

# utils

## PlaySoundBlueprintNode (class)

Built-in blueprint node: plays a transient, self-disposing one-shot sound - the blueprint
analogue of `AudioSource(2d|3d)Entity.playOneShot`. Has one input pin, `"trigger"` (a data pin
that also acts as this node's trigger, same convention as `RemoveEntity`'s `"entity"` pin) and
no output pins.

Where the sound plays: `settings.position`, if given, is used as-is; otherwise, if the
triggering value looks positionable (has a `position` property - true for the `IEntity &
IPositionable(2d|3d)` a `"Trigger"` entity's `onEntityEntered`/`onEntityLeft` emits), that
position is used. If neither is available, the source plays wherever the adapter's own
`createSource` defaults a fresh source to (usually world origin) - harmless for a non-spatial
(`spatial: false`) sound, but likely not what's wanted for a positional one.

A world with no `audioScene` logs a warning and does nothing (matching `RemoveEntity`'s
missing-reference posture) rather than throwing.

**Signature**

```ts
export declare class PlaySoundBlueprintNode<D, R, TypeDoc>
```

### trigger (method)

**Signature**

```ts
public trigger(inputName: string, value?: unknown): void
```

### resolvePayloadPosition (method)

**Signature**

```ts
private resolvePayloadPosition(value: unknown): D | undefined
```

### resolvePayloadImpulse (method)

**Signature**

```ts
private resolvePayloadImpulse(value: unknown): number | undefined
```

### pickImpactTier (method)

**Signature**

```ts
private pickImpactTier(
    tiers: readonly PlaySoundImpactTier[] | undefined,
    impulse: number,
  ): PlaySoundImpactTier | undefined
```

### inputs (property)

**Signature**

```ts
readonly inputs: readonly BlueprintPinDefinition[]
```

### outputs (property)

**Signature**

```ts
readonly outputs: readonly BlueprintPinDefinition[]
```

## PlaySoundImpactTier (interface)

One impulse-tiered clip variant - see {@link PlaySoundNodeSettings.impactClips}.

**Signature**

```ts
export interface PlaySoundImpactTier {
  /**
   * Minimum triggering-payload `impulse` (inclusive) required to select this tier, in the same
   * units as `CollisionEvent.impulse`. Tiers are compared, not ordered - list them in any order.
   */
  minImpulse: number

  /** Clip to play when this tier is selected, same semantics as {@link PlaySoundNodeSettings.clip}. */
  clip: string

  /** Overrides {@link PlaySoundNodeSettings.volume} when this tier is selected. */
  volume?: number

  /** Overrides {@link PlaySoundNodeSettings.playbackRate} when this tier is selected. */
  playbackRate?: number
}
```

## PlaySoundNodeSettings (interface)

Settings for the built-in `"PlaySound"` blueprint node - baked in from its
{@link BlueprintNodeJson.settings}, not wired at runtime.

**Signature**

```ts
export interface PlaySoundNodeSettings {
  /**
   * URL of the clip to play, resolved via `audioScene.factory.loadClip` (the adapter's own
   * fetch+decode caching applies, so triggering this node repeatedly for the same `clip` doesn't
   * re-fetch/re-decode every time). Used as-is unless {@link impactClips} is set and a tier
   * matches the triggering payload - see there.
   */
  clip: string

  volume?: number
  playbackRate?: number

  /** Positional vs. flat/non-positional playback. Defaults to `true`. */
  spatial?: boolean

  /** Output bus/category (e.g. `"sfx"`). Defaults to `"sfx"`. */
  bus?: string

  /**
   * Fixed world-space position (`Point2`/`Point3`, matching the world's own dimensionality) to
   * play at, overriding whatever the triggering payload carries. Leave unset to play at the
   * triggering payload's own `position` instead (see {@link PlaySoundBlueprintNode}'s doc) - the
   * usual case for "pop a sound where something just happened" (e.g. wired to a `"Trigger"`
   * entity's `onEntityEntered`).
   */
  position?: unknown

  /**
   * Play a different clip (and optionally volume/playback rate) depending on how hard the
   * triggering collision was - e.g. a light tap vs. a hard crash. Meant for a `"onCollisionStart"`
   * binding (`Entity(2d|3d).onCollisionStart`'s payload carries a numeric `impulse` at its top
   * level - see `CollisionEvent`), matched against each tier's `minImpulse` the same way `position`
   * above is duck-typed off the payload. The node selects the tier with the highest `minImpulse`
   * that's still `<=` the payload's `impulse`, falling back to the top-level `clip`/`volume`/
   * `playbackRate` settings when the payload carries no numeric `impulse` (e.g. wired to a
   * `"Trigger"` entity's `onEntityEntered` instead) or no tier's threshold is met.
   */
  impactClips?: PlaySoundImpactTier[]
}
```
