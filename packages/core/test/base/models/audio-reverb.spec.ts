import {
  DEFAULT_AUDIO_REVERB,
  MAX_AUDIO_REVERB_DECAY,
  resolveAudioReverbSettings,
  sameAudioReverbShape,
} from '../../../src';

describe('resolveAudioReverbSettings', () => {
  it('fills every field left out with its default', () => {
    expect(resolveAudioReverbSettings({})).toEqual(DEFAULT_AUDIO_REVERB);
    expect(resolveAudioReverbSettings({ wet: 0.5, decay: 2 })).toEqual({
      ...DEFAULT_AUDIO_REVERB,
      wet: 0.5,
      decay: 2,
    });
  });

  it('keeps zero values instead of replacing them with defaults', () => {
    const resolved = resolveAudioReverbSettings({ wet: 0, dry: 0, preDelay: 0, damping: 0 });
    expect(resolved).toEqual({ wet: 0, dry: 0, decay: DEFAULT_AUDIO_REVERB.decay, preDelay: 0, damping: 0 });
  });

  it.each([
    [{ wet: -0.1 }, 'wet'],
    [{ dry: -1 }, 'dry'],
    [{ wet: NaN }, 'wet'],
    [{ dry: Infinity }, 'dry'],
    [{ decay: 0 }, 'decay'],
    [{ decay: MAX_AUDIO_REVERB_DECAY + 1 }, 'decay'],
    [{ preDelay: -0.01 }, 'preDelay'],
    [{ preDelay: 2 }, 'preDelay'],
    [{ damping: 1.5 }, 'damping'],
  ])('rejects %p', (settings, field) => {
    expect(() => resolveAudioReverbSettings(settings)).toThrow(new RegExp(`reverb ${field}`));
    expect(() => resolveAudioReverbSettings(settings)).toThrow(RangeError);
  });
});

describe('sameAudioReverbShape', () => {
  it('ignores wet/dry and compares decay, preDelay and damping', () => {
    const base = resolveAudioReverbSettings({});
    expect(sameAudioReverbShape(base, resolveAudioReverbSettings({ wet: 0.9, dry: 0.2 }))).toBe(true);
    expect(sameAudioReverbShape(base, resolveAudioReverbSettings({ decay: 3 }))).toBe(false);
    expect(sameAudioReverbShape(base, resolveAudioReverbSettings({ preDelay: 0.1 }))).toBe(false);
    expect(sameAudioReverbShape(base, resolveAudioReverbSettings({ damping: 0.1 }))).toBe(false);
  });
});
