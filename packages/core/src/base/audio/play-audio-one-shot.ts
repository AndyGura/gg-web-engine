import { take } from 'rxjs';
import { AudioOneShotDescriptor } from '../components/audio/i-audio-scene.component';
import { AudioSourceDescriptor, IAudioSourceComponent } from '../components/audio/i-audio-source.component';

/**
 * `IAudioSceneComponent.playOneShot` written once over any audio adapter's factory: creates a
 * non-positional, non-looping source from `descriptor`, plays it and disposes it the moment it
 * ends (`ended$`, which also fires for a one-shot that ends while virtual). An adapter's scene
 * implements `playOneShot` by calling this with its own factory.
 * @param factory - the scene's source factory (`audioScene.factory`)
 * @param descriptor - what to play; `loop`, `autoplay` and `spatial` are fixed by the one-shot
 * @returns the playing source - `dispose()` on it cuts the sound short
 */
export function playAudioOneShot<Clip, Source extends IAudioSourceComponent<any, any, any>>(
  factory: { createSource(descriptor: AudioSourceDescriptor<Clip>): Source },
  descriptor: AudioOneShotDescriptor<Clip>,
): Source {
  const source = factory.createSource({ ...descriptor, loop: false, spatial: false, autoplay: false });
  // `take(1)`, not an unsubscribe inside the callback: the clip may end within `play()` itself (a
  // clip of zero length), before a subscription handle would exist. `dispose()` completes `ended$`,
  // which ends this subscription too when the app cuts the sound short.
  source.ended$.pipe(take(1)).subscribe(() => source.dispose());
  source.play();
  return source;
}
