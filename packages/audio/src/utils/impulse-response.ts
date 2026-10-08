import { ResolvedAudioReverbSettings } from '@gg-web-engine/core';

/** Lowest cutoff (Hz) the damping low-pass reaches, at the end of the tail with `damping: 1`. */
export const REVERB_DAMPED_CUTOFF_HZ = 250;

/** Cutoff (Hz) of the undamped tail - its start, and all of it with `damping: 0`. Capped below
 * Nyquist at low sample rates. */
export const REVERB_BRIGHT_CUTOFF_HZ = 16000;

/** ln(1000): an amplitude falling by this many nepers has fallen by 60 dB - the RT60 definition. */
const LN_60_DB = Math.log(1000);

/** Small deterministic PRNG (mulberry32), so a given set of settings always yields the same
 * impulse response. Returns floats in [0, 1). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Builds a procedural reverb impulse response: `preDelay` seconds of silence, then `decay` seconds
 * of noise whose amplitude falls exponentially by 60 dB over `decay` (the RT60 definition), run
 * through a one-pole low-pass whose cutoff slides from `REVERB_BRIGHT_CUTOFF_HZ` down towards
 * `REVERB_DAMPED_CUTOFF_HZ` as the tail goes on (`damping` is how far it slides: `0` not at all,
 * `1` all the way by the end), so high frequencies die out faster than low ones, as in a real room.
 *
 * Each channel gets its own noise, so a stereo response is decorrelated (wide) rather than mono.
 * Deterministic for given arguments. Not normalized: `ConvolverNode.normalize` (on by default)
 * evens out the loudness of different responses.
 * @returns one `Float32Array` per channel, all `ceil((preDelay + decay) * sampleRate)` samples long
 */
export function generateImpulseResponse(
  sampleRate: number,
  settings: Pick<ResolvedAudioReverbSettings, 'decay' | 'preDelay' | 'damping'>,
  channels: number = 2,
): Float32Array[] {
  const { decay, preDelay, damping } = settings;
  const delaySamples = Math.round(preDelay * sampleRate);
  const length = Math.max(1, Math.ceil((preDelay + decay) * sampleRate));
  const tailSamples = length - delaySamples;
  const brightHz = Math.min(REVERB_BRIGHT_CUTOFF_HZ, sampleRate * 0.45);
  const darkHz = Math.min(REVERB_DAMPED_CUTOFF_HZ, brightHz);
  // per-sample multipliers: the envelope falls by 60 dB, and the cutoff by `damping` of the way
  // from bright to dark (in log frequency), over `decay` seconds
  const envelopeStep = Math.exp(-LN_60_DB / (decay * sampleRate));
  const cutoffStep = Math.pow(darkHz / brightHz, damping / (decay * sampleRate));
  const angularPerHz = (2 * Math.PI) / sampleRate;

  const result: Float32Array[] = [];
  for (let channel = 0; channel < channels; channel++) {
    const data = new Float32Array(length);
    const random = mulberry32(0x5eed + channel * 0x9e3779b9);
    let envelope = 1;
    let cutoff = brightHz;
    let filtered = 0;
    for (let i = 0; i < tailSamples; i++) {
      const alpha = 1 - Math.exp(-angularPerHz * cutoff);
      filtered += alpha * (random() * 2 - 1 - filtered);
      data[delaySamples + i] = filtered * envelope;
      envelope *= envelopeStep;
      cutoff *= cutoffStep;
    }
    result.push(data);
  }
  return result;
}
