import {
  AudioSourceDescriptor,
  IAudioSource2dComponentFactory,
  IAudioSource3dComponentFactory,
} from '@gg-web-engine/core';
import { WebAudioScene3dComponent } from './components/web-audio-scene-3d.component';
import { WebAudioScene2dComponent } from './components/web-audio-scene-2d.component';
import { WebAudioSource3dComponent } from './components/web-audio-source-3d.component';
import { WebAudioSource2dComponent } from './components/web-audio-source-2d.component';

export class WebAudioSource3dComponentFactory implements IAudioSource3dComponentFactory {
  constructor(private readonly scene: WebAudioScene3dComponent) {}

  public loadClip(url: string): Promise<AudioBuffer> {
    return this.scene.loadClip(url);
  }

  public createSource(descriptor: AudioSourceDescriptor<AudioBuffer>): WebAudioSource3dComponent {
    return new WebAudioSource3dComponent(this.scene, descriptor);
  }
}

export class WebAudioSource2dComponentFactory implements IAudioSource2dComponentFactory {
  constructor(private readonly scene: WebAudioScene2dComponent) {}

  public loadClip(url: string): Promise<AudioBuffer> {
    return this.scene.loadClip(url);
  }

  public createSource(descriptor: AudioSourceDescriptor<AudioBuffer>): WebAudioSource2dComponent {
    return new WebAudioSource2dComponent(this.scene, descriptor);
  }
}
