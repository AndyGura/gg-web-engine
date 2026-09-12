import { WebAudioSource3dComponentFactory, WebAudioSource2dComponentFactory } from './web-audio-factory';
import { WebAudioSource3dComponent } from './components/web-audio-source-3d.component';
import { WebAudioSource2dComponent } from './components/web-audio-source-2d.component';

export type WebAudioTypeDocRepo3D = {
  factory: WebAudioSource3dComponentFactory;
  source: WebAudioSource3dComponent;
  clip: AudioBuffer;
};

export type WebAudioTypeDocRepo2D = {
  factory: WebAudioSource2dComponentFactory;
  source: WebAudioSource2dComponent;
  clip: AudioBuffer;
};
