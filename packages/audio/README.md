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
then `priority`, then loudness at the listener (volume x bus volume x parent bus volumes x distance
attenuation), with a
slight preference for the sources already heard so near-equal ones don't swap back and forth. A
virtual one-shot stays virtual until it would have ended, then fires `ended$` as usual.

`source.isPlaying` stays `true` while virtual; `source.isVirtual` tells whether it is heard.
`world.audioScene.voiceCounts` gives `{ playing, audible, virtual }`, and the dev console command
`audio_voices [int|inf]` reads or sets the budget and prints those counts.

### Bus layout

Buses are created on first use, by name (`AudioSourceDescriptor.bus`, default `"sfx"`), and each one
feeds the master output. `setBusParent(bus, parent)` makes a bus feed another bus instead, so the
parent's volume and reverb apply to it as well - the usual game mixer layout, where everything that
happens in the world shares one environment reverb and music and UI stay dry beside it:

```typescript
const audio = world.audioScene!;
audio.setBusParent('engine', 'world');
audio.setBusParent('sfx', 'world');
audio.setBusParent('ambient', 'world');
audio.setBusReverb('world', { decay: 1.8, wet: 0 }); // one tunnel echo for all three

audio.setBusVolume('engine', settings.engineVolume); // a player's separate volume sliders
audio.setBusVolume('sfx', settings.effectsVolume);
audio.setBusVolume('world', 1);
audio.setBusVolume('music', settings.musicVolume);
```

Volumes multiply down the chain (`engine` x `world` x master). `getBusVolume` returns the volume a
bus itself was given, `getEffectiveBusVolume` the product with its parents'. Set the layout up once:
moving a bus that is playing can click. `setBusParent(bus, null)` sends it back to the master
output, and a parent that would form a cycle throws a `RangeError`. The dev console command
`audio_bus_parent BUS [PARENT|master]` reads or changes it.

### Bus reverb

A bus can have a reverb: one convolver shared by every source routed through it and through its child
buses (an echoing tunnel, a cave, a hall), applied after the bus volume and mixed with the direct
sound.

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

`applyMobileAudioDefaults(world.audioScene!)` (from core) does both mobile settings at once on a
touch device - `'equalpower'` and a 16-voice budget (`MOBILE_AUDIO_DEFAULTS`) - and nothing
elsewhere; its second argument overrides the touch detection.

### Fades, UI sounds and music

```typescript
import { MusicPlayer } from '@gg-web-engine/core';

// a timed fade on the audio clock (pauses with the world); `volume` reads 0 at once
if (await theme.fadeTo(0, 800)) {
  theme.stop(); // only if nothing faded it back in meanwhile
}

// a sound with no place in the world, on a scene that needs no world at all
const menuAudio = new WebAudioScene3dComponent();
await menuAudio.init();
menuAudio.playOneShot({ clip: await menuAudio.factory.loadClip('click.ogg'), bus: 'ui' });

// music: crossfades, shuffle without repeats, a "now playing" feed, on the "music" bus
const music = new MusicPlayer(menuAudio);
music.nowPlaying$.subscribe(track => showNowPlaying(track));
music.play([{ url: 'track1.ogg' }, { url: 'track2.ogg' }], { shuffle: true, crossfadeMs: 1500 });
```

`fadeTo` is a linear ramp on the source's gain, scheduled on the `AudioContext` clock: it holds
while the context is suspended, continues through `stop()`/`play()`, and a virtual source picks it
up where it has got to when heard again. It resolves `false` when a `volume` write, another
`fadeTo` or `dispose()` took over. `MusicPlayer` decodes each track whole before playing it.

See the root repo's audio design write-up and the `gg-engine-audio-adapter` skill for the full
architecture (static/attached/one-shot sources, the listener-selection rules for multi-renderer
worlds, and why positional-audio jitter on a fast/near-listener source is fixed here rather than
being an app-level workaround).
