import { applyMobileAudioDefaults, MOBILE_AUDIO_DEFAULTS, MouseInput, playAudioOneShot } from '../../../src';
import { FakeAudioSource, fakeAudioScene } from '../../mocks/audio-scene.mock';

describe('playAudioOneShot', () => {
  it('plays a non-positional, non-looping source and disposes it at its end', () => {
    const { factory, sources } = fakeAudioScene();
    const source: any = playAudioOneShot(factory, { clip: 'click', bus: 'ui', volume: 0.4, priority: 3 });
    expect(source).toBe(sources[0]);
    expect(source.descriptor).toEqual({
      clip: 'click',
      bus: 'ui',
      volume: 0.4,
      priority: 3,
      loop: false,
      spatial: false,
      autoplay: false,
    });
    expect(source.play).toHaveBeenCalled();
    expect(source.dispose).not.toHaveBeenCalled();
    source.end();
    expect(source.dispose).toHaveBeenCalledTimes(1);
  });

  it('disposes a clip that ends within play()', () => {
    const { factory } = fakeAudioScene();
    factory.createSource.mockImplementationOnce((descriptor: any) => {
      const source = new FakeAudioSource(descriptor);
      source.play = jest.fn(() => source.end());
      return source;
    });
    const source: any = playAudioOneShot(factory, { clip: 'empty' });
    expect(source.dispose).toHaveBeenCalledTimes(1);
  });
});

describe('applyMobileAudioDefaults', () => {
  it('sets the voice budget and the panning model of a 3D scene on a mobile device', () => {
    const scene = { maxVoices: Infinity, defaultPanningModel: 'HRTF' as 'HRTF' | 'equalpower' };
    expect(applyMobileAudioDefaults(scene, true)).toBe(true);
    expect(scene).toEqual({ maxVoices: MOBILE_AUDIO_DEFAULTS.maxVoices, defaultPanningModel: 'equalpower' });
  });

  it('keeps a smaller budget, and sets no panning model on a 2D scene', () => {
    const scene: any = { maxVoices: 8 };
    applyMobileAudioDefaults(scene, true);
    expect(scene).toEqual({ maxVoices: 8 });
  });

  it('does nothing on other devices', () => {
    const scene = { maxVoices: Infinity, defaultPanningModel: 'HRTF' as 'HRTF' | 'equalpower' };
    expect(applyMobileAudioDefaults(scene, false)).toBe(false);
    expect(scene).toEqual({ maxVoices: Infinity, defaultPanningModel: 'HRTF' });
  });

  it('detects a touch device by default', () => {
    const spy = jest.spyOn(MouseInput, 'isTouchDevice').mockReturnValue(true);
    const scene = { maxVoices: Infinity };
    expect(applyMobileAudioDefaults(scene)).toBe(true);
    expect(scene.maxVoices).toBe(16);
    spy.mockReturnValue(false);
    const desktop = { maxVoices: Infinity };
    expect(applyMobileAudioDefaults(desktop)).toBe(false);
    spy.mockRestore();
  });
});
