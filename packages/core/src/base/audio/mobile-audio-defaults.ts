import { IAudioSceneComponent } from '../components/audio/i-audio-scene.component';
import { MouseInput } from '../inputs/mouse.input';

/**
 * Audio settings for a phone or tablet, what {@link applyMobileAudioDefaults} applies. Mobile
 * browsers have no hard limit on simultaneous sources, but every source costs audio-thread CPU,
 * an HRTF panner most of all (a convolution per source, roughly ten times the cost of
 * `'equalpower'`), and an overloaded audio thread makes sounds drop out or crackle.
 *
 * - `maxVoices`: the voice budget (`IAudioSceneComponent.maxVoices`) - beyond it the
 *   lowest-ranked sources go virtual.
 * - `panningModel`: the 3D scene's `defaultPanningModel` - plain left/right panning instead of
 *   HRTF. A 2D scene has no panning model to set.
 */
export const MOBILE_AUDIO_DEFAULTS: { readonly maxVoices: number; readonly panningModel: 'equalpower' } = {
  maxVoices: 16,
  panningModel: 'equalpower',
};

/**
 * Applies {@link MOBILE_AUDIO_DEFAULTS} to an audio scene when `mobile` is true: lowers
 * `maxVoices` to the preset's budget (a smaller budget the app set already is kept) and, on a 3D
 * scene, sets `defaultPanningModel` to `'equalpower'`. Does nothing on other devices, so it can be
 * called unconditionally on every new scene. Call it before creating sources: the panning model
 * applies to sources created afterwards (`IAudioSource3dComponent.panningModel` changes one that
 * exists).
 * @param scene - a 2D or 3D audio scene (`world.audioScene`, or a scene of its own)
 * @param mobile - whether to apply the preset; defaults to `MouseInput.isTouchDevice()`. Pass your
 *   own detection (or a setting the player can change) to override it.
 * @returns whether the preset was applied
 */
export function applyMobileAudioDefaults(
  scene: Pick<IAudioSceneComponent<any, any, any>, 'maxVoices'> & { defaultPanningModel?: 'HRTF' | 'equalpower' },
  mobile: boolean = MouseInput.isTouchDevice(),
): boolean {
  if (!mobile) {
    return false;
  }
  scene.maxVoices = Math.min(scene.maxVoices, MOBILE_AUDIO_DEFAULTS.maxVoices);
  if ('defaultPanningModel' in scene) {
    scene.defaultPanningModel = MOBILE_AUDIO_DEFAULTS.panningModel;
  }
  return true;
}
