<p align="center">
  <img src="../../documentation/assets/banner.png" width="100%" alt="GG Web Engine"/>
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

### Voice budget and priority

Every playing source is rendered by default. On a phone, dozens of looping positional sources (an
HRTF panner each) can overload the audio thread, which then glitches or drops sound. Give sources
a `priority` (higher is more important, default `0`) and the scene a voice budget:

```typescript
world.audioScene!.maxVoices = 16; // default Infinity: no limit, no ranking

const horn = world.audioScene!.factory.createSource({ clip: hornClip, loop: true, priority: 100 });
engine.priority = 50; // also writable at runtime
```

Beyond the budget, the lowest-ranked playing sources go *virtual*: faded out, then stopped and
disconnected so they cost no audio processing, while their playback position keeps advancing.
Once they rank inside the budget again they fade back in where they would be by now. Ranking,
redone every frame: a source heard before a silent one (a loop kept at volume 0 never takes a voice),
then `priority`, then loudness at the listener (volume x bus volume x distance attenuation), with a
slight preference for the sources already heard so near-equal ones don't swap back and forth. A
virtual one-shot stays virtual until it would have ended, then fires `ended$` as usual.

`source.isPlaying` stays `true` while virtual; `source.isVirtual` tells whether it is heard.
`world.audioScene.voiceCounts` gives `{ playing, audible, virtual }`, and the dev console command
`audio_voices [int|inf]` reads or sets the budget and prints those counts.

### Bus reverb

A bus can have a reverb: one convolver shared by every source routed through it (an echoing tunnel,
a cave, a hall), applied after the bus volume and mixed with the direct sound.

```typescript
// a car in a tunnel: hard walls, a fairly long, bright tail
const tunnel = { decay: 1.8, preDelay: 0.03, damping: 0.3 };

// at load time, silent: builds the impulse response up front
world.audioScene!.setBusReverb('sfx', { ...tunnel, wet: 0 });

// every frame: fade the reverb in while inside, out when leaving
wet += ((inTunnel ? 0.4 : 0) - wet) * Math.min(1, delta / 300);
world.audioScene!.setBusReverb('sfx', { ...tunnel, wet: wet < 0.005 ? 0 : wet });

world.audioScene!.setBusReverb('sfx', null); // remove it altogether
```

Settings (`AudioReverbSettings`, every field optional, a field left out gets its default rather than
its previous value):

| Field | Default | Meaning |
|---|---|---|
| `wet` | `0.3` | level of the reverberated signal, `>= 0` |
| `dry` | `1` | level of the direct signal, `>= 0` |
| `decay` | `1.5` | seconds for the tail to fall by 60 dB (RT60), up to `10` |
| `preDelay` | `0.02` | seconds before the tail starts, up to `1` |
| `damping` | `0.5` | `0`-`1`, how much faster high frequencies die out: `0` bright (concrete, tiles), `1` dull |

`wet`/`dry` changes are ramped, so calling it every frame with a changing `wet` fades without
clicks. Changing `decay`/`preDelay`/`damping` regenerates the impulse response (procedural decaying
noise) and crossfades to a new convolver - keep them constant while fading. At `wet: 0` the
convolver fades out and is disconnected a moment later, so a reverb that is off costs no audio
processing; the impulse response is kept, ready for the next fade-in. `getBusReverb(bus)` returns
the current settings, and the dev console command `audio_reverb BUS [wet|off] [decay] [preDelay]
[damping]` reads or changes them.

### Panning model (3D)

3D sources pan with an HRTF `PannerNode` by default, which also conveys front/back and elevation but
runs a convolution per source. `'equalpower'` is a plain left/right split, far cheaper on the audio
thread. Switch every new 3D source over in one place, or choose per source:

```typescript
if (isMobile) {
  world.audioScene!.defaultPanningModel = 'equalpower'; // sources created from now on
}
const horn = world.audioScene!.factory.createSource({ clip: hornClip, panningModel: 'HRTF' });
horn.panningModel = 'equalpower'; // also writable at runtime
```

See the root repo's audio design write-up and the `gg-engine-audio-adapter` skill for the full
architecture (static/attached/one-shot sources, the listener-selection rules for multi-renderer
worlds, and why positional-audio jitter on a fast/near-listener source is fixed here rather than
being an app-level workaround).
