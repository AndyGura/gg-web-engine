/**
 * Reverb on an audio bus - see `IAudioSceneComponent.setBusReverb`. Every field is optional;
 * `resolveAudioReverbSettings` fills in the defaults (`DEFAULT_AUDIO_REVERB`), so every adapter
 * agrees on them.
 *
 * `wet`/`dry` are levels, changed smoothly and cheap to change every frame (fading the reverb in
 * and out is just a series of `setBusReverb` calls with a changing `wet`). `decay`/`preDelay`/
 * `damping` shape the reverb itself: changing one rebuilds it, which is not meant for every frame.
 */
export type AudioReverbSettings = {
  /**
   * Level of the reverberated signal, `>= 0`. Default `0.3`. `0` means no reverb heard: once it
   * has faded out the adapter stops processing it, while keeping the shape (`decay`/`preDelay`/
   * `damping`) ready for the next fade-in.
   */
  wet?: number;
  /** Level of the direct (unreverberated) signal, `>= 0`. Default `1`. */
  dry?: number;
  /**
   * Reverb time in seconds: how long the tail takes to fall by 60 dB (RT60), `> 0` and `<= 10`.
   * Default `1.5`. Small rooms ~0.3-0.8, halls and tunnels ~1.5-3.
   */
  decay?: number;
  /**
   * Seconds between the direct sound and the start of the tail, `0`-`1`. Default `0.02`. Larger
   * values read as a bigger space (the first reflection comes from farther away).
   */
  preDelay?: number;
  /**
   * How much faster high frequencies die out than low ones, `0`-`1`. Default `0.5`. `0` keeps the
   * whole tail bright (hard surfaces: concrete, tiles, metal), `1` leaves only a dull rumble at its
   * end (soft, absorbent spaces).
   */
  damping?: number;
};

/** `AudioReverbSettings` with every default filled in. */
export type ResolvedAudioReverbSettings = Readonly<Required<AudioReverbSettings>>;

/** The defaults `resolveAudioReverbSettings` fills in. */
export const DEFAULT_AUDIO_REVERB: ResolvedAudioReverbSettings = Object.freeze({
  wet: 0.3,
  dry: 1,
  decay: 1.5,
  preDelay: 0.02,
  damping: 0.5,
});

/** Upper bound of `AudioReverbSettings.decay`, seconds - the impulse response is held in memory. */
export const MAX_AUDIO_REVERB_DECAY = 10;

/** Upper bound of `AudioReverbSettings.preDelay`, seconds. */
export const MAX_AUDIO_REVERB_PRE_DELAY = 1;

/**
 * Fills in `AudioReverbSettings` defaults and validates the result - shared by adapters so they all
 * agree on both. Throws a `RangeError` naming the first field out of its documented range.
 */
export function resolveAudioReverbSettings(settings: AudioReverbSettings): ResolvedAudioReverbSettings {
  const resolved: ResolvedAudioReverbSettings = {
    wet: settings.wet ?? DEFAULT_AUDIO_REVERB.wet,
    dry: settings.dry ?? DEFAULT_AUDIO_REVERB.dry,
    decay: settings.decay ?? DEFAULT_AUDIO_REVERB.decay,
    preDelay: settings.preDelay ?? DEFAULT_AUDIO_REVERB.preDelay,
    damping: settings.damping ?? DEFAULT_AUDIO_REVERB.damping,
  };
  const check = (field: keyof AudioReverbSettings, valid: (v: number) => boolean, range: string) => {
    const value = resolved[field];
    if (!Number.isFinite(value) || !valid(value)) {
      throw new RangeError(`reverb ${field} must be ${range}, got ${value}`);
    }
  };
  check('wet', v => v >= 0, '>= 0');
  check('dry', v => v >= 0, '>= 0');
  check('decay', v => v > 0 && v <= MAX_AUDIO_REVERB_DECAY, `> 0 and <= ${MAX_AUDIO_REVERB_DECAY}`);
  check('preDelay', v => v >= 0 && v <= MAX_AUDIO_REVERB_PRE_DELAY, `between 0 and ${MAX_AUDIO_REVERB_PRE_DELAY}`);
  check('damping', v => v >= 0 && v <= 1, 'between 0 and 1');
  return resolved;
}

/** Whether two resolved settings describe the same reverb shape (`decay`/`preDelay`/`damping`),
 * i.e. differ in `wet`/`dry` at most. */
export function sameAudioReverbShape(a: ResolvedAudioReverbSettings, b: ResolvedAudioReverbSettings): boolean {
  return a.decay === b.decay && a.preDelay === b.preDelay && a.damping === b.damping;
}
