import { AudioSourceDescriptor, IAudioSceneComponent } from '@gg-web-engine/core';

interface Voice<D, R> {
  source: ReturnType<IAudioSceneComponent<D, R>['factory']['createSource']>;
  busy: boolean;
  lastUsed: number;
}

/**
 * A fixed-size pool of reusable {@link IAudioSourceComponent} "voices" for high-frequency transient
 * sounds (a debris field, a crowd of impacts) - see the audio RFC's "Pooling for high-frequency
 * transients" section. What's actually bounded/reused here is each voice's own gain/panner node
 * chain, not the underlying `AudioBufferSourceNode` (which the Web Audio spec only allows starting
 * once per instance regardless - `IAudioSourceComponent.play()` always creates a fresh one
 * internally): without a pool, a debris field playing dozens of impacts per second would keep
 * allocating a fresh `PannerNode`+`GainNode` chain per hit and hitting the browser's cap on
 * concurrent audio nodes; with one, at most `size` such chains ever exist for this pool's clip.
 *
 * Every voice in one pool shares the same `descriptor` (clip, volume, spatial, bus, ...) -
 * position (and, if given, rotation) are the only things that vary per `play()` call. Use a
 * separate pool per distinct sound effect.
 */
export class AudioSourcePool<D, R> {
  private readonly voices: Voice<D, R>[] = [];

  constructor(
    private readonly scene: IAudioSceneComponent<D, R>,
    private readonly descriptor: AudioSourceDescriptor<unknown>,
    private readonly size: number = 16,
  ) {}

  /**
   * Play this pool's sound once at `position` (and `rotation`, if given): reuses a free voice,
   * grows the pool (up to `size`) if none is free, or steals the least-recently-used busy voice
   * once the pool is full.
   */
  public play(position: D, rotation?: R): void {
    let voice = this.voices.find(v => !v.busy);
    if (!voice) {
      if (this.voices.length < this.size) {
        voice = {
          source: this.scene.factory.createSource({ ...this.descriptor, loop: false, autoplay: false }),
          busy: false,
          lastUsed: 0,
        };
        this.voices.push(voice);
      } else {
        voice = this.voices.reduce((oldest, candidate) => (candidate.lastUsed < oldest.lastUsed ? candidate : oldest));
        voice.source.stop();
      }
    }
    voice.busy = true;
    voice.lastUsed = Date.now();
    voice.source.position = position;
    if (rotation !== undefined) {
      voice.source.rotation = rotation;
    }
    const currentVoice = voice;
    const subscription = currentVoice.source.ended$.subscribe(() => {
      currentVoice.busy = false;
      subscription.unsubscribe();
    });
    currentVoice.source.play();
  }

  public dispose(): void {
    for (const voice of this.voices) {
      voice.source.dispose();
    }
    this.voices.splice(0, this.voices.length);
  }
}
