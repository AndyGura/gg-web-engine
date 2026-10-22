import { MusicPlayer, Point3 } from '@gg-web-engine/core';
import { VOICE_UPKEEP_INTERVAL_MS, VOICE_UPKEEP_WATCH_MS } from '../../src/components/web-audio-scene-base.component';
import { WebAudioScene3dComponent } from '../../src/components/web-audio-scene-3d.component';
import { WebAudioSource3dComponent } from '../../src/components/web-audio-source-3d.component';
import { VIRTUAL_FADE_SECONDS } from '../../src/components/web-audio-source-base.component';

class FakeParam {
  /** where the last ramp (or jump) is heading */
  public target: number;

  constructor(public value: number) {
    this.target = value;
  }

  setTargetAtTime = jest.fn((value: number) => {
    this.target = value;
  });
  setValueAtTime = jest.fn((value: number) => {
    this.value = value;
    this.target = value;
  });
  linearRampToValueAtTime = jest.fn((value: number) => {
    this.target = value;
  });
  cancelScheduledValues = jest.fn();
}

class FakeNode {
  connect = jest.fn();
  disconnect = jest.fn();
}

class FakeGainNode extends FakeNode {
  public gain = new FakeParam(1);
}

class FakePannerNode extends FakeNode {
  public positionX = new FakeParam(0);
  public positionY = new FakeParam(0);
  public positionZ = new FakeParam(0);
  public orientationX = new FakeParam(1);
  public orientationY = new FakeParam(0);
  public orientationZ = new FakeParam(0);
  public panningModel = 'equalpower';
  public distanceModel = 'inverse';
  public refDistance = 1;
  public maxDistance = 10000;
  public rolloffFactor = 1;
  public coneInnerAngle = 360;
  public coneOuterAngle = 360;
  public coneOuterGain = 0;
}

class FakeBufferSource extends FakeNode {
  public buffer: unknown = null;
  public loop = false;
  public loopStart = 0;
  public loopEnd = 0;
  public playbackRate = new FakeParam(1);
  public onended: (() => void) | null = null;
  public startOffset: number | null = null;
  /** context time of `start()`, set by `FakeAudioContext` */
  public startedAt: number | null = null;
  public stopped = false;
  start = jest.fn((_when: number, offset: number) => {
    this.startOffset = offset;
  });
  stop = jest.fn(() => {
    this.stopped = true;
  });
}

class FakeAudioContext {
  public state = 'running';
  public currentTime = 0;
  public destination = {};
  public onstatechange: (() => void) | null = null;
  public listener = {
    positionX: new FakeParam(0),
    positionY: new FakeParam(0),
    positionZ: new FakeParam(0),
    forwardX: new FakeParam(0),
    forwardY: new FakeParam(0),
    forwardZ: new FakeParam(-1),
    upX: new FakeParam(0),
    upY: new FakeParam(1),
    upZ: new FakeParam(0),
  };
  public bufferSources: FakeBufferSource[] = [];
  createGain = jest.fn(() => new FakeGainNode());
  createPanner = jest.fn(() => new FakePannerNode());
  createBufferSource = jest.fn(() => {
    const node = new FakeBufferSource();
    node.start.mockImplementation((_when: number, offset: number) => {
      node.startOffset = offset;
      node.startedAt = this.currentTime;
    });
    this.bufferSources.push(node);
    return node;
  });
  resume = jest.fn(() => Promise.resolve());
  suspend = jest.fn(() => Promise.resolve());
  close = jest.fn(() => Promise.resolve());
}

type Internals = {
  gainNode: FakeGainNode;
  panner: FakePannerNode;
  bufferSource: FakeBufferSource | null;
};

describe('voice budget (WebAudioScene3dComponent)', () => {
  let originalAudioContext: unknown;
  let scene: WebAudioScene3dComponent;
  let context: FakeAudioContext;
  const clip = { duration: 10 } as unknown as AudioBuffer;

  const internals = (source: WebAudioSource3dComponent) => source as unknown as Internals;

  function play(
    descriptor: { priority?: number; volume?: number; loop?: boolean; playbackRate?: number },
    position: Point3 = { x: 0, y: 0, z: 0 },
  ): WebAudioSource3dComponent {
    const source = scene.factory.createSource({ clip, loop: true, autoplay: false, ...descriptor });
    source.position = position;
    source.play();
    return source;
  }

  /** advances the audio clock and runs one scene tick */
  function tick(seconds: number) {
    context.currentTime += seconds;
    scene.update(0, seconds * 1000);
  }

  beforeEach(() => {
    originalAudioContext = (global as any).AudioContext;
    (global as any).AudioContext = FakeAudioContext;
    scene = new WebAudioScene3dComponent();
    context = scene.context as unknown as FakeAudioContext;
  });

  afterEach(() => {
    scene.dispose();
    (global as any).AudioContext = originalAudioContext;
  });

  it('renders every playing source by default (budget Infinity)', () => {
    expect(scene.maxVoices).toBe(Infinity);
    const sources = [0, 1, 2, 3, 4].map(() => play({}));
    tick(1);
    expect(sources.every(s => s.isPlaying && !s.isVirtual)).toBe(true);
    expect(context.bufferSources).toHaveLength(5);
    expect(scene.voiceCounts).toEqual({ playing: 5, audible: 5, virtual: 0 });
  });

  it('starts a newcomer virtual when it ranks outside a full budget, without a buffer source', () => {
    scene.maxVoices = 1;
    const horn = play({ priority: 100 });
    const click = play({ priority: 30 });
    expect(horn.isVirtual).toBe(false);
    expect(click.isPlaying).toBe(true);
    expect(click.isVirtual).toBe(true);
    expect(context.bufferSources).toHaveLength(1);
    expect(internals(click).gainNode.disconnect).toHaveBeenCalled();
    expect(scene.voiceCounts).toEqual({ playing: 2, audible: 1, virtual: 1 });
  });

  it('fades out an outranked source, then stops and disconnects it', () => {
    scene.maxVoices = 1;
    const engine = play({ priority: 50 });
    const engineBuffer = internals(engine).bufferSource!;
    const horn = play({ priority: 100 });

    expect(horn.isVirtual).toBe(false);
    expect(engine.isVirtual).toBe(true);
    expect(internals(engine).gainNode.gain.target).toBe(0); // fading out, still rendering
    expect(engineBuffer.stopped).toBe(false);

    tick(VIRTUAL_FADE_SECONDS / 2);
    expect(engineBuffer.stopped).toBe(false);
    tick(VIRTUAL_FADE_SECONDS);
    expect(engineBuffer.stopped).toBe(true);
    expect(internals(engine).bufferSource).toBeNull();
    expect(internals(engine).panner.disconnect).toHaveBeenCalled();
    expect(engine.isPlaying).toBe(true);
  });

  it('fades a virtual loop back in where it would be by now', () => {
    scene.maxVoices = 1;
    const engine = play({ priority: 50, volume: 0.8, playbackRate: 2 });
    const horn = play({ priority: 100 });
    tick(1); // fade done, engine fully virtual
    tick(5.5); // engine has now "played" 6.5 s x rate 2 = 13 s of a 10 s loop

    horn.stop();
    tick(0.5); // 7 s x 2 = 14 s
    expect(engine.isVirtual).toBe(false);
    const restarted = internals(engine).bufferSource!;
    expect(restarted).not.toBeNull();
    expect(restarted.startOffset).toBeCloseTo(4);
    const gain = internals(engine).gainNode.gain;
    expect(gain.setValueAtTime).toHaveBeenLastCalledWith(0, expect.any(Number));
    expect(gain.target).toBe(0.8); // ramping up from silence
    expect(internals(engine).gainNode.connect).toHaveBeenCalled();
  });

  it('turns a source back up without restarting it when promoted during its fade-out', () => {
    scene.maxVoices = 1;
    const engine = play({ priority: 50 });
    const firstBuffer = internals(engine).bufferSource;
    const horn = play({ priority: 100 });
    tick(VIRTUAL_FADE_SECONDS / 4);
    horn.stop();
    tick(VIRTUAL_FADE_SECONDS / 4);
    expect(engine.isVirtual).toBe(false);
    expect(internals(engine).bufferSource).toBe(firstBuffer);
    expect(firstBuffer!.stopped).toBe(false);
    expect(internals(engine).gainNode.gain.target).toBe(1);
  });

  it('breaks equal priorities by loudness at the listener', () => {
    scene.setActiveListener({ position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 } });
    scene.maxVoices = 1;
    const far = play({ priority: 50 }, { x: 0, y: 5000, z: 0 });
    const near = play({ priority: 50 }, { x: 0, y: 10, z: 0 });
    expect(near.isVirtual).toBe(false);
    expect(far.isVirtual).toBe(true);

    // the far one drives right up to the listener: it takes the voice on the next tick
    far.position = { x: 0, y: 1, z: 0 };
    near.position = { x: 0, y: 3000, z: 0 };
    tick(0.016);
    expect(far.isVirtual).toBe(false);
    expect(near.isVirtual).toBe(true);
  });

  it('never gives a voice to a muted loop while an audible source needs it', () => {
    scene.maxVoices = 1;
    const squeal = play({ priority: 70, volume: 0 });
    const engine = play({ priority: 50 });
    expect(engine.isVirtual).toBe(false);
    expect(squeal.isVirtual).toBe(true);

    squeal.volume = 1; // a skid starts
    tick(0.016);
    expect(squeal.isVirtual).toBe(false);
    expect(engine.isVirtual).toBe(true);
  });

  it('counts a source on a muted parent bus as silent', () => {
    scene.setBusParent('engine', 'world');
    scene.maxVoices = 1;
    const engine = scene.factory.createSource({ clip, loop: true, autoplay: false, bus: 'engine', priority: 70 });
    engine.play();
    const music = play({ priority: 10 });
    expect(engine.isVirtual).toBe(false);
    expect(music.isVirtual).toBe(true);

    scene.setBusVolume('world', 0);
    tick(0.016);
    expect(engine.isVirtual).toBe(true);
    expect(music.isVirtual).toBe(false);
  });

  it('keeps a virtual one-shot running silently and ends it when it would have ended', () => {
    scene.maxVoices = 1;
    play({ priority: 100 });
    const hit = play({ priority: 80, loop: false });
    const ended = jest.fn();
    hit.ended$.subscribe(ended);
    expect(hit.isVirtual).toBe(true);

    tick(9.9);
    expect(hit.isPlaying).toBe(true);
    expect(ended).not.toHaveBeenCalled();
    tick(0.2);
    expect(hit.isPlaying).toBe(false);
    expect(hit.isVirtual).toBe(false);
    expect(ended).toHaveBeenCalledTimes(1);
    expect(scene.voiceCounts).toEqual({ playing: 1, audible: 1, virtual: 0 });
  });

  it('does not schedule position writes on a virtual source, and catches up when it is heard again', () => {
    scene.maxVoices = 1;
    const engine = play({ priority: 50 });
    const horn = play({ priority: 100 });
    tick(1);
    const panner = internals(engine).panner;
    panner.positionX.setTargetAtTime.mockClear();

    engine.position = { x: 42, y: 0, z: 0 };
    expect(panner.positionX.setTargetAtTime).not.toHaveBeenCalled();

    horn.stop();
    tick(0.016);
    expect(panner.positionX.setValueAtTime).toHaveBeenLastCalledWith(42, expect.any(Number));
  });

  it('plays a source moved while it ended virtually from its new position', () => {
    scene.maxVoices = 1;
    const horn = play({ priority: 100 });
    const hit = play({ priority: 80, loop: false }, { x: 1, y: 0, z: 0 });
    expect(hit.isVirtual).toBe(true);
    tick(10.1); // the one-shot ends while virtual, its chain still disconnected
    expect(hit.isPlaying).toBe(false);

    horn.stop();
    const panner = internals(hit).panner;
    panner.positionX.setValueAtTime.mockClear();
    hit.position = { x: 42, y: 0, z: 0 }; // pool-style reuse: move, then play
    hit.play();
    expect(hit.isVirtual).toBe(false);
    expect(panner.positionX.setValueAtTime).toHaveBeenCalledWith(42, expect.any(Number));
    expect(internals(hit).bufferSource!.start).toHaveBeenCalled();
  });

  it('applies a budget change at once and restores everything on Infinity', () => {
    const sources = [10, 20, 30].map(priority => play({ priority }));
    scene.maxVoices = 1;
    expect(sources.map(s => s.isVirtual)).toEqual([true, true, false]);
    scene.maxVoices = Infinity;
    expect(sources.every(s => !s.isVirtual)).toBe(true);
    expect(() => (scene.maxVoices = -1)).toThrow(RangeError);
    expect(() => (scene.maxVoices = NaN)).toThrow(RangeError);
  });

  it('pausing a virtual source releases its voice and resumes from its position', () => {
    scene.maxVoices = 1;
    const engine = play({ priority: 50 });
    const horn = play({ priority: 100 });
    tick(1);
    tick(2); // engine at 3 s
    engine.pause();
    expect(engine.isPlaying).toBe(false);
    expect(engine.isVirtual).toBe(false);
    expect(scene.voiceCounts.playing).toBe(1);

    horn.stop();
    tick(5); // paused: no time passes for it
    engine.play();
    expect(engine.isVirtual).toBe(false);
    expect(internals(engine).bufferSource!.startOffset).toBeCloseTo(3);
    expect(internals(engine).gainNode.gain.target).toBe(1);
  });

  it('carries priority through clone() and rejects NaN', () => {
    const source = scene.factory.createSource({ clip, autoplay: false, priority: 7 });
    expect(source.clone().priority).toBe(7);
    expect(() => (source.priority = NaN)).toThrow(RangeError);
    expect(scene.factory.createSource({ clip, autoplay: false }).priority).toBe(0);
  });
});

describe('panning model (WebAudioScene3dComponent)', () => {
  let originalAudioContext: unknown;
  let scene: WebAudioScene3dComponent;
  const clip = { duration: 10 } as unknown as AudioBuffer;
  const pannerOf = (source: WebAudioSource3dComponent) => (source as unknown as Internals).panner;

  beforeEach(() => {
    originalAudioContext = (global as any).AudioContext;
    (global as any).AudioContext = FakeAudioContext;
    scene = new WebAudioScene3dComponent();
  });

  afterEach(() => {
    scene.dispose();
    (global as any).AudioContext = originalAudioContext;
  });

  it('defaults to HRTF', () => {
    expect(scene.defaultPanningModel).toBe('HRTF');
    const source = scene.factory.createSource({ clip, autoplay: false });
    expect(source.panningModel).toBe('HRTF');
    expect(pannerOf(source).panningModel).toBe('HRTF');
  });

  it("gives new sources the scene's default, leaving existing ones and explicit choices alone", () => {
    const before = scene.factory.createSource({ clip, autoplay: false });
    scene.defaultPanningModel = 'equalpower';
    const after = scene.factory.createSource({ clip, autoplay: false });
    const explicit = scene.factory.createSource({ clip, autoplay: false, panningModel: 'HRTF' });
    expect(before.panningModel).toBe('HRTF');
    expect(after.panningModel).toBe('equalpower');
    expect(explicit.panningModel).toBe('HRTF');
  });

  it('switches one source at runtime and keeps it through clone()', () => {
    const source = scene.factory.createSource({ clip, autoplay: false });
    source.panningModel = 'equalpower';
    expect(pannerOf(source).panningModel).toBe('equalpower');
    expect(source.clone().panningModel).toBe('equalpower');
  });
});

describe('voice budget on a scene no world updates (WebAudioScene3dComponent)', () => {
  let originalAudioContext: unknown;
  let scene: WebAudioScene3dComponent;
  let context: FakeAudioContext;
  const clip = { duration: 10 } as unknown as AudioBuffer;
  const internals = (source: WebAudioSource3dComponent) => source as unknown as Internals;

  function play(descriptor: { priority?: number; volume?: number; loop?: boolean }): WebAudioSource3dComponent {
    const source = scene.factory.createSource({ clip, loop: true, autoplay: false, spatial: false, ...descriptor });
    source.play();
    return source;
  }

  /**
   * Lets `seconds` of wall and audio time pass in timer-sized steps, never calling `update()`. A
   * buffer source still rendering a non-looping clip fires `onended` once it has played it through,
   * as the browser would.
   */
  function wait(seconds: number) {
    const steps = Math.max(1, Math.round((seconds * 1000) / VOICE_UPKEEP_INTERVAL_MS));
    for (let i = 0; i < steps; i++) {
      context.currentTime += seconds / steps;
      for (const node of [...context.bufferSources]) {
        const duration = (node.buffer as AudioBuffer | null)?.duration ?? 0;
        if (
          !node.stopped &&
          !node.loop &&
          node.startedAt !== null &&
          context.currentTime - node.startedAt + (node.startOffset ?? 0) >= duration
        ) {
          node.stopped = true;
          node.onended?.();
        }
      }
      jest.advanceTimersByTime((seconds * 1000) / steps);
    }
  }

  beforeEach(() => {
    jest.useFakeTimers();
    originalAudioContext = (global as any).AudioContext;
    (global as any).AudioContext = FakeAudioContext;
    scene = new WebAudioScene3dComponent();
    context = scene.context as unknown as FakeAudioContext;
  });

  afterEach(() => {
    scene.dispose();
    (global as any).AudioContext = originalAudioContext;
    jest.useRealTimers();
  });

  it('finishes fade-outs and promotes virtual sources once voices stop', () => {
    scene.maxVoices = 2;
    const loops = [10, 20, 30, 40].map(priority => play({ priority }));
    expect(loops.map(s => s.isVirtual)).toEqual([true, true, false, false]);
    wait(1);
    expect(internals(loops[0]).bufferSource).toBeNull(); // fully virtual: stopped and disconnected

    loops[3].stop();
    loops[2].stop();
    wait(VOICE_UPKEEP_INTERVAL_MS / 1000);
    expect(loops[0].isVirtual).toBe(false);
    expect(loops[1].isVirtual).toBe(false);
    expect(internals(loops[0]).bufferSource!.start).toHaveBeenCalled();
    expect(internals(loops[0]).gainNode.gain.target).toBe(1);
    expect(scene.voiceCounts).toEqual({ playing: 2, audible: 2, virtual: 0 });
    expect(jest.getTimerCount()).toBe(0); // nothing virtual: the scene stops checking
  });

  it('ends a virtual one-shot that ran out, so playOneShot disposes it', () => {
    scene.maxVoices = 1;
    play({ priority: 100 });
    const click = scene.playOneShot({ clip, priority: 50 }) as WebAudioSource3dComponent;
    // playOneShot's own subscription disposes the source on `ended$`, which completes `ended$`
    const disposed = jest.fn();
    click.ended$.subscribe({ complete: disposed });
    expect(click.isVirtual).toBe(true);

    wait(9.9);
    expect(click.isPlaying).toBe(true);
    expect(disposed).not.toHaveBeenCalled();
    wait(0.2);
    expect(click.isPlaying).toBe(false);
    expect(disposed).toHaveBeenCalled();
    expect(scene.voiceCounts).toEqual({ playing: 1, audible: 1, virtual: 0 });
  });

  it('keeps a MusicPlayer and UI sounds working after bursts of one-shots over the budget', async () => {
    scene.maxVoices = 4;
    const musicClip = { duration: 100 } as unknown as AudioBuffer;
    const blip = { duration: 0.5 } as unknown as AudioBuffer;
    const player = new MusicPlayer(scene, { loadClip: () => Promise.resolve(musicClip) });
    await player.play({ url: 'menu.ogg', loop: true });
    const musicSource = () => (player as any).current.source as WebAudioSource3dComponent;
    const firstTrack = musicSource();
    wait(1.5); // fade-in done

    for (let burst = 0; burst < 5; burst++) {
      for (let i = 0; i < 8; i++) {
        scene.playOneShot({ clip: blip, priority: 10 });
      }
      expect(scene.voiceCounts.virtual).toBeGreaterThan(0);
      expect(firstTrack.isVirtual).toBe(false); // music outranks every one-shot
      wait(0.3);
    }
    wait(1);
    expect(scene.voiceCounts).toEqual({ playing: 1, audible: 1, virtual: 0 });

    // a click is heard at once
    const click = scene.playOneShot({ clip: blip, priority: 10 }) as WebAudioSource3dComponent;
    expect(click.isVirtual).toBe(false);
    // and the next track, starting its fade-in at volume 0, is heard too
    await player.play({ url: 'options.ogg', loop: true });
    expect(musicSource()).not.toBe(firstTrack);
    expect(musicSource().isVirtual).toBe(false);
    wait(1.5); // the crossfade ends, the first track is released
    for (let i = 0; i < 5; i++) {
      await Promise.resolve(); // the fade's promise, then MusicPlayer's release
    }
    expect(firstTrack.isPlaying).toBe(false);
    expect(musicSource().isPlaying).toBe(true);
    expect(scene.voiceCounts).toEqual({ playing: 1, audible: 1, virtual: 0 });
    player.dispose();
  });

  it('leaves the bookkeeping to update() while a world drives the scene', () => {
    scene.maxVoices = 1;
    play({ priority: 100 });
    const engine = play({ priority: 50 });
    const advance = jest.spyOn(engine, 'advanceVirtual');
    const timers = jest.spyOn(global, 'setTimeout');
    let updates = 0;
    for (let i = 0; i < 60; i++) {
      context.currentTime += 0.016;
      jest.advanceTimersByTime(16);
      scene.update(0, 16);
      updates++;
    }
    expect(advance).toHaveBeenCalledTimes(updates);
    // only an occasional check that the world still ticks, not a timer every 50 ms
    expect(timers.mock.calls.length).toBeLessThanOrEqual(Math.ceil((60 * 16) / VOICE_UPKEEP_WATCH_MS) + 1);
    timers.mockRestore();

    // the world stops ticking: the scene takes over
    advance.mockClear();
    wait((2 * VOICE_UPKEEP_WATCH_MS) / 1000 + 0.1);
    expect(advance.mock.calls.length).toBeGreaterThan(0);
  });

  it('does not take an update() from before the timer was armed for a world still ticking', () => {
    scene.maxVoices = 1;
    const horn = play({ priority: 100 });
    for (let i = 0; i < 3; i++) {
      scene.update(0, 16); // a world updated it a while ago, with nothing virtual
    }
    const engine = play({ priority: 50 }); // the world has stopped since
    expect(engine.isVirtual).toBe(true);
    horn.stop();
    wait(VOICE_UPKEEP_INTERVAL_MS / 1000);
    expect(engine.isVirtual).toBe(false);
  });

  it('stops checking while paused and once disposed', () => {
    scene.maxVoices = 1;
    const horn = play({ priority: 100 });
    const engine = play({ priority: 50 });
    expect(jest.getTimerCount()).toBe(1);
    scene.setPaused(true);
    expect(jest.getTimerCount()).toBe(0);
    horn.stop();
    wait(1);
    expect(engine.isVirtual).toBe(true); // nothing happens while paused

    scene.setPaused(false);
    wait(VOICE_UPKEEP_INTERVAL_MS / 1000);
    expect(engine.isVirtual).toBe(false);

    play({ priority: 100 });
    expect(jest.getTimerCount()).toBe(1);
    scene.dispose();
    expect(jest.getTimerCount()).toBe(0);
  });
});
