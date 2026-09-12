<p align="center">
  <img src="../../documentation/assets/logo.png" style="height: 400px; width:400px;" alt=''/>
</p>

## [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API) integration for [gg-web-engine](https://github.com/AndyGura/gg-web-engine), providing 2D/3D positional audio

`@gg-web-engine/audio` implements core's `audioScene` contract directly against the browser's
native Web Audio API - there's no third-party audio library dependency to install alongside it.

### Installation:
1) make sure **@gg-web-engine/core** installed
1) `npm install --save @gg-web-engine/audio`

### Usage
```typescript
import { WebAudioScene3dComponent } from '@gg-web-engine/audio';

const world = new Gg3dWorld({
  visualScene: /* ... */,
  physicsWorld: /* ... */,
  audioScene: new WebAudioScene3dComponent(),
});
await world.init();

const clip = await world.audioScene!.factory.loadClip('assets/engine-loop.mp3');
const source = world.audioScene!.factory.createSource({ clip, loop: true });
```

See the root repo's audio design write-up and the `gg-engine-audio-adapter` skill for the full
architecture (static/attached/one-shot sources, the listener-selection rules for multi-renderer
worlds, and why positional-audio jitter on a fast/near-listener source is fixed here rather than
being an app-level workaround).
