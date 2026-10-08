import { generateImpulseResponse } from '../../src/utils/impulse-response';

const SAMPLE_RATE = 8000;

function rms(data: Float32Array, from: number, to: number): number {
  let sum = 0;
  for (let i = from; i < to; i++) {
    sum += data[i] * data[i];
  }
  return Math.sqrt(sum / (to - from));
}

/** share of a segment's energy in its sample-to-sample differences - a rough "brightness" */
function brightness(data: Float32Array, from: number, to: number): number {
  let diff = 0;
  let total = 0;
  for (let i = from + 1; i < to; i++) {
    diff += (data[i] - data[i - 1]) ** 2;
    total += data[i] ** 2;
  }
  return diff / total;
}

describe('generateImpulseResponse', () => {
  it('is preDelay of silence followed by decay seconds of tail, one array per channel', () => {
    const channels = generateImpulseResponse(SAMPLE_RATE, { decay: 1, preDelay: 0.1, damping: 0.5 }, 2);
    expect(channels).toHaveLength(2);
    for (const data of channels) {
      expect(data).toHaveLength(Math.ceil(1.1 * SAMPLE_RATE));
      expect(data.subarray(0, 0.1 * SAMPLE_RATE).every(v => v === 0)).toBe(true);
      expect(data[0.1 * SAMPLE_RATE + 1]).not.toBe(0);
    }
  });

  it('falls by about 60 dB over the decay time', () => {
    const [data] = generateImpulseResponse(SAMPLE_RATE, { decay: 2, preDelay: 0, damping: 0 }, 1);
    const window = SAMPLE_RATE / 20;
    const start = rms(data, 0, window);
    const end = rms(data, data.length - window, data.length);
    const db = 20 * Math.log10(end / start);
    expect(db).toBeLessThan(-50);
    expect(db).toBeGreaterThan(-70);
  });

  it('gives each channel its own noise (a wide stereo tail)', () => {
    const [left, right] = generateImpulseResponse(SAMPLE_RATE, { decay: 0.5, preDelay: 0, damping: 0 }, 2);
    let dot = 0;
    for (let i = 0; i < left.length; i++) {
      dot += left[i] * right[i];
    }
    const correlation = dot / (rms(left, 0, left.length) * rms(right, 0, right.length) * left.length);
    expect(Math.abs(correlation)).toBeLessThan(0.1);
  });

  it('darkens the end of the tail more with more damping', () => {
    const settings = { decay: 1, preDelay: 0 };
    const [bright] = generateImpulseResponse(44100, { ...settings, damping: 0 }, 1);
    const [dark] = generateImpulseResponse(44100, { ...settings, damping: 1 }, 1);
    const tail = (data: Float32Array) => brightness(data, data.length - 4410, data.length);
    const head = (data: Float32Array) => brightness(data, 0, 4410);
    expect(tail(dark)).toBeLessThan(tail(bright) / 10);
    // the early part stays bright either way
    expect(head(dark)).toBeGreaterThan(head(bright) / 3);
  });

  it('is deterministic', () => {
    const settings = { decay: 0.3, preDelay: 0.01, damping: 0.4 };
    expect(generateImpulseResponse(SAMPLE_RATE, settings)).toEqual(generateImpulseResponse(SAMPLE_RATE, settings));
  });
});
