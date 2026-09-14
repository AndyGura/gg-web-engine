import {
  Gg2dWorld,
  Gg2dWorldSceneTypeDocAPatch,
  Gg2dWorldTypeDocAPatch,
  Gg3dWorld,
  Gg3dWorldSceneTypeDocAPatch,
  Gg3dWorldTypeDocAPatch,
} from '@gg-web-engine/core';
import { WebAudioSource3dComponentFactory, WebAudioSource2dComponentFactory } from './web-audio-factory';
import { WebAudioSource3dComponent } from './components/web-audio-source-3d.component';
import { WebAudioSource2dComponent } from './components/web-audio-source-2d.component';
import { WebAudioScene3dComponent } from './components/web-audio-scene-3d.component';
import { WebAudioScene2dComponent } from './components/web-audio-scene-2d.component';

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

// Mirrors ThreeTypeDoc/ThreeSceneTypeDoc/ThreeGgWorld in packages/three (and their
// Ammo/Rapier/Matter counterparts) so `TypedGg3dWorld<VW, PW, WebAudioGgWorld3D>`/
// `TypedGg2dWorld<VW, PW, WebAudioGgWorld2D>` can compose a fully-typed world the same way an app
// already composes its visual/physics halves.
export type WebAudioTypeDoc3D = Gg3dWorldTypeDocAPatch<WebAudioTypeDocRepo3D>;
export type WebAudioSceneTypeDoc3D = Gg3dWorldSceneTypeDocAPatch<WebAudioTypeDocRepo3D, WebAudioScene3dComponent>;
export type WebAudioGgWorld3D = Gg3dWorld<WebAudioTypeDoc3D, WebAudioSceneTypeDoc3D>;

export type WebAudioTypeDoc2D = Gg2dWorldTypeDocAPatch<WebAudioTypeDocRepo2D>;
export type WebAudioSceneTypeDoc2D = Gg2dWorldSceneTypeDocAPatch<WebAudioTypeDocRepo2D, WebAudioScene2dComponent>;
export type WebAudioGgWorld2D = Gg2dWorld<WebAudioTypeDoc2D, WebAudioSceneTypeDoc2D>;
