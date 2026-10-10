---
title: core/base/models/audio-reverb.ts
nav_order: 155
parent: Modules
---

## audio-reverb overview

Reverb on an audio bus - see `IAudioSceneComponent.setBusReverb`. Every field is optional;
`resolveAudioReverbSettings` fills in the defaults (`DEFAULT_AUDIO_REVERB`), so every adapter
agrees on them.

`wet`/`dry` are levels, changed smoothly and cheap to change every frame (fading the reverb in
and out is just a series of `setBusReverb` calls with a changing `wet`). `decay`/`preDelay`/
`damping` shape the reverb itself: changing one rebuilds it, which is not meant for every frame.

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [AudioReverbSettings (type alias)](#audioreverbsettings-type-alias)
  - [DEFAULT_AUDIO_REVERB](#default_audio_reverb)
  - [MAX_AUDIO_REVERB_DECAY](#max_audio_reverb_decay)
  - [MAX_AUDIO_REVERB_PRE_DELAY](#max_audio_reverb_pre_delay)
  - [ResolvedAudioReverbSettings (type alias)](#resolvedaudioreverbsettings-type-alias)
  - [resolveAudioReverbSettings](#resolveaudioreverbsettings)
  - [sameAudioReverbShape](#sameaudioreverbshape)

---

# utils

## AudioReverbSettings (type alias)

Reverb on an audio bus - see `IAudioSceneComponent.setBusReverb`. Every field is optional;
`resolveAudioReverbSettings` fills in the defaults (`DEFAULT_AUDIO_REVERB`), so every adapter
agrees on them.

`wet`/`dry` are levels, changed smoothly and cheap to change every frame (fading the reverb in
and out is just a series of `setBusReverb` calls with a changing `wet`). `decay`/`preDelay`/
`damping` shape the reverb itself: changing one rebuilds it, which is not meant for every frame.

**Signature**

```ts
export type AudioReverbSettings = {
  /**
   * Level of the reverberated signal, `>= 0`. Default `0.3`. `0` means no reverb heard: once it
   * has faded out the adapter stops processing it, while keeping the shape (`decay`/`preDelay`/
   * `damping`) ready for the next fade-in.
   */
  wet?: number
  /** Level of the direct (unreverberated) signal, `>= 0`. Default `1`. */
  dry?: number
  /**
   * Reverb time in seconds: how long the tail takes to fall by 60 dB (RT60), `> 0` and `<= 10`.
   * Default `1.5`. Small rooms ~0.3-0.8, halls and tunnels ~1.5-3.
   */
  decay?: number
  /**
   * Seconds between the direct sound and the start of the tail, `0`-`1`. Default `0.02`. Larger
   * values read as a bigger space (the first reflection comes from farther away).
   */
  preDelay?: number
  /**
   * How much faster high frequencies die out than low ones, `0`-`1`. Default `0.5`. `0` keeps the
   * whole tail bright (hard surfaces: concrete, tiles, metal), `1` leaves only a dull rumble at its
   * end (soft, absorbent spaces).
   */
  damping?: number
}
```

## DEFAULT_AUDIO_REVERB

The defaults `resolveAudioReverbSettings` fills in.

**Signature**

```ts
export declare const DEFAULT_AUDIO_REVERB: Readonly<Required<AudioReverbSettings>>
```

## MAX_AUDIO_REVERB_DECAY

Upper bound of `AudioReverbSettings.decay`, seconds - the impulse response is held in memory.

**Signature**

```ts
export declare const MAX_AUDIO_REVERB_DECAY: 10
```

## MAX_AUDIO_REVERB_PRE_DELAY

Upper bound of `AudioReverbSettings.preDelay`, seconds.

**Signature**

```ts
export declare const MAX_AUDIO_REVERB_PRE_DELAY: 1
```

## ResolvedAudioReverbSettings (type alias)

`AudioReverbSettings` with every default filled in.

**Signature**

```ts
export type ResolvedAudioReverbSettings = Readonly<Required<AudioReverbSettings>>
```

## resolveAudioReverbSettings

Fills in `AudioReverbSettings` defaults and validates the result - shared by adapters so they all
agree on both. Throws a `RangeError` naming the first field out of its documented range.

**Signature**

```ts
export declare function resolveAudioReverbSettings(settings: AudioReverbSettings): ResolvedAudioReverbSettings
```

## sameAudioReverbShape

Whether two resolved settings describe the same reverb shape (`decay`/`preDelay`/`damping`),
i.e. differ in `wet`/`dry` at most.

**Signature**

```ts
export declare function sameAudioReverbShape(a: ResolvedAudioReverbSettings, b: ResolvedAudioReverbSettings): boolean
```
