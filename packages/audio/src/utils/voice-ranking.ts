/**
 * Effective gain at or below which a playing source counts as silent when ranking voices
 * (-80 dB): such a source loses its voice to any audible one regardless of priority - a loop kept
 * running at volume 0 (a tyre squeal waiting for a skid) must never push out a sound being heard.
 */
export const SILENT_VOICE_GAIN = 1e-4;

/**
 * How much louder a virtual source has to be than an equal-priority audible one to take its voice.
 * Without it two near-equal sources at the budget's edge (two cars at about the same distance)
 * would swap every frame, each swap a fade out and a fade in.
 */
export const AUDIBLE_VOICE_BIAS = 1.25;

/** What `rankVoices` needs to know about one playing source. */
export interface VoiceCandidate {
  /** `IAudioSourceComponent.priority`, higher is more important. */
  priority: number;
  /** Estimated gain at the listener: volume x bus volume x distance attenuation. */
  gain: number;
  /** Whether the source is heard right now (gets `AUDIBLE_VOICE_BIAS`). */
  audible: boolean;
  /** Creation order, the final tie-break: the older source wins. */
  order: number;
}

/**
 * Orders two voice candidates, most deserving of a voice first: audible before silent (see
 * `SILENT_VOICE_GAIN`), then higher priority, then louder (with `AUDIBLE_VOICE_BIAS` for the one
 * already heard), then the one already heard, then the older one.
 */
export function compareVoices(a: VoiceCandidate, b: VoiceCandidate): number {
  const aSilent = a.gain <= SILENT_VOICE_GAIN;
  const bSilent = b.gain <= SILENT_VOICE_GAIN;
  if (aSilent !== bSilent) {
    return aSilent ? 1 : -1;
  }
  if (a.priority !== b.priority) {
    return a.priority > b.priority ? -1 : 1;
  }
  const aGain = a.gain * (a.audible ? AUDIBLE_VOICE_BIAS : 1);
  const bGain = b.gain * (b.audible ? AUDIBLE_VOICE_BIAS : 1);
  if (aGain !== bGain) {
    return aGain > bGain ? -1 : 1;
  }
  if (a.audible !== b.audible) {
    return a.audible ? -1 : 1;
  }
  return a.order - b.order;
}

/**
 * Splits playing sources into the `maxVoices` that get rendered and the rest, which go virtual -
 * see `IAudioSceneComponent.maxVoices` for the ranking rules (`compareVoices`).
 */
export function rankVoices<T extends VoiceCandidate>(
  candidates: readonly T[],
  maxVoices: number,
): { audible: T[]; virtual: T[] } {
  if (candidates.length <= maxVoices) {
    return { audible: [...candidates], virtual: [] };
  }
  const sorted = [...candidates].sort(compareVoices);
  const cut = Math.max(0, Math.floor(maxVoices));
  return { audible: sorted.slice(0, cut), virtual: sorted.slice(cut) };
}
