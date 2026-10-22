import { WebAudioScene2dComponent } from '../../src/components/web-audio-scene-2d.component';
import { WebAudioScene3dComponent } from '../../src/components/web-audio-scene-3d.component';
import { WebAudioSource3dComponent } from '../../src/components/web-audio-source-3d.component';
import { RESUME_GESTURE_EVENTS } from '../../src/components/web-audio-scene-base.component';

type AutomationEvent =
  | { type: 'set'; time: number; value: number }
  | { type: 'target'; time: number; value: number; tau: number }
  | { type: 'linear'; time: number; value: number };

/** An `AudioParam` keeping its automation timeline, so a test can ask for its value at any time. */
class FakeParam {
  public events: AutomationEvent[] = [];

  constructor(public value: number) {}

  setValueAtTime = jest.fn((value: number, time: number) => this.insert({ type: 'set', time, value }));
  setTargetAtTime = jest.fn((value: number, time: number, tau: number) =>
    this.insert({ type: 'target', time, value, tau }),
  );
  linearRampToValueAtTime = jest.fn((value: number, time: number) => this.insert({ type: 'linear', time, value }));
  cancelScheduledValues = jest.fn((time: number) => {
    this.events = this.events.filter(e => e.time < time);
  });

  private insert(event: AutomationEvent) {
    let index = this.events.length;
    while (index > 0 && this.events[index - 1].time > event.time) {
      index--;
    }
    this.events.splice(index, 0, event);
  }

  valueAt(t: number): number {
    let anchorTime = 0;
    let anchorValue = this.value;
    let target: { value: number; tau: number } | null = null;
    let lastTime = 0;
    const curve = (time: number) =>
      target ? target.value + (anchorValue - target.value) * Math.exp(-(time - anchorTime) / target.tau) : anchorValue;
    for (const e of this.events) {
      if (e.type === 'linear') {
        const startValue = curve(lastTime);
        if (t < e.time) {
          return t <= lastTime
            ? curve(t)
            : startValue + ((e.value - startValue) * (t - lastTime)) / (e.time - lastTime);
        }
        anchorTime = e.time;
        anchorValue = e.value;
        target = null;
      } else {
        if (e.time > t) {
          break;
        }
        anchorValue = curve(e.time);
        anchorTime = e.time;
        if (e.type === 'set') {
          anchorValue = e.value;
          target = null;
        } else {
          target = { value: e.value, tau: e.tau };
        }
      }
      lastTime = e.time;
    }
    return curve(t);
  }
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

class FakeStereoPannerNode extends FakeNode {
  public pan = new FakeParam(0);
}

class FakeBufferSource extends FakeNode {
  public buffer: unknown = null;
  public loop = false;
  public loopStart = 0;
  public loopEnd = 0;
  public playbackRate = new FakeParam(1);
  public onended: (() => void) | null = null;
  public stopped = false;
  /** the clip offset `start()` was given */
  public offset: number | null = null;
  start = jest.fn((_when: number, offset: number) => {
    this.offset = offset;
  });
  stop = jest.fn(() => {
    this.stopped = true;
  });
}

const LISTENER_PARAMS = [
  'positionX',
  'positionY',
  'positionZ',
  'forwardX',
  'forwardY',
  'forwardZ',
  'upX',
  'upY',
  'upZ',
];

class FakeAudioContext {
  public state = 'running';
  public currentTime = 0;
  public sampleRate = 44100;
  public destination = new FakeNode();
  public listener = Object.fromEntries(LISTENER_PARAMS.map(k => [k, new FakeParam(0)])) as Record<string, FakeParam>;
  public bufferSources: FakeBufferSource[] = [];
  public gains: FakeGainNode[] = [];
  createGain = jest.fn(() => {
    const node = new FakeGainNode();
    this.gains.push(node);
    return node;
  });
  createPanner = jest.fn(() => new FakePannerNode());
  createStereoPanner = jest.fn(() => new FakeStereoPannerNode());
  createBufferSource = jest.fn(() => {
    const node = new FakeBufferSource();
    this.bufferSources.push(node);
    return node;
  });
  createBuffer = jest.fn((channels: number, length: number, sampleRate: number) => ({
    numberOfChannels: channels,
    length,
    sampleRate,
    getChannelData: () => new Float32Array(length),
  }));
  createConvolver = jest.fn(() => Object.assign(new FakeNode(), { buffer: null, normalize: true }));
  resume = jest.fn(() => Promise.resolve());
  suspend = jest.fn(() => Promise.resolve());
  close = jest.fn(() => {
    this.state = 'closed';
    return Promise.resolve();
  });
}

type Internals = { gainNode: FakeGainNode; masterGain: FakeGainNode; bufferSource: FakeBufferSource | null };

const clip = { duration: 100 } as unknown as AudioBuffer;

describe('a scene on a shared AudioContext', () => {
  let originalAudioContext: unknown;
  let owner: WebAudioScene3dComponent;
  let shared: FakeAudioContext;
  let world: WebAudioScene3dComponent;

  const internals = (x: unknown) => x as Internals;
  const gainOf = (source: WebAudioSource3dComponent) => internals(source).gainNode.gain;
  const bufferOf = (source: WebAudioSource3dComponent) => internals(source).bufferSource;

  function play(
    scene: WebAudioScene3dComponent,
    descriptor: { volume?: number; priority?: number; loop?: boolean } = {},
  ): WebAudioSource3dComponent {
    const source = scene.factory.createSource({ clip, loop: true, autoplay: false, ...descriptor });
    source.play();
    return source;
  }

  /** advances the audio clock and wall time together (no scene tick) */
  function advance(seconds: number) {
    shared.currentTime += seconds;
    jest.advanceTimersByTime(seconds * 1000);
  }

  beforeEach(() => {
    jest.useFakeTimers();
    originalAudioContext = (global as any).AudioContext;
    (global as any).AudioContext = FakeAudioContext;
    owner = new WebAudioScene3dComponent();
    shared = owner.context as unknown as FakeAudioContext;
    world = new WebAudioScene3dComponent({ context: owner.context });
  });

  afterEach(() => {
    world.dispose();
    owner.dispose();
    (global as any).AudioContext = originalAudioContext;
    jest.useRealTimers();
  });

  it('builds its graph on the given context, which it does not own', () => {
    expect(owner.ownsContext).toBe(true);
    expect(world.ownsContext).toBe(false);
    expect(world.context).toBe(owner.context);
    const master = internals(world).masterGain;
    expect(shared.gains).toContain(master);
    expect(master.connect).toHaveBeenCalledWith(shared.destination);
    const bus = world.getBusNode('sfx') as unknown as FakeGainNode;
    expect(shared.gains).toContain(bus);
    expect(bus).not.toBe(owner.getBusNode('sfx'));
  });

  it('keeps volumes, bus layout and the voice budget per scene', () => {
    world.masterVolume = 0.5;
    world.setBusVolume('music', 0.2);
    world.setBusParent('engine', 'world');
    world.maxVoices = 4;
    expect(owner.masterVolume).toBe(1);
    expect(owner.getBusVolume('music')).toBe(1);
    expect(owner.getBusParent('engine')).toBeNull();
    expect(owner.maxVoices).toBe(Infinity);
    play(world);
    expect(owner.voiceCounts.playing).toBe(0);
    expect(world.voiceCounts.playing).toBe(1);
  });

  it('works for the 2D scene too', () => {
    const scene2d = new WebAudioScene2dComponent({ context: owner.context });
    expect(scene2d.ownsContext).toBe(false);
    expect(scene2d.context).toBe(owner.context);
    scene2d.dispose();
    expect(shared.close).not.toHaveBeenCalled();
    expect(new WebAudioScene2dComponent().ownsContext).toBe(true);
  });

  describe('dispose', () => {
    it('never closes the context and leaves the owner and its sources alone', () => {
      const menuClick = play(owner);
      const ownerMaster = internals(owner).masterGain;
      const ownerBus = owner.getBusNode('sfx') as unknown as FakeGainNode;
      world.setBusReverb('sfx', { wet: 0.4 });
      const worldBus = world.getBusNode('sfx') as unknown as FakeGainNode;
      const worldMaster = internals(world).masterGain;
      // a source of the world scene that was never added to a world (a MusicPlayer track, a pooled voice)
      const engine = play(world);
      const engineBuffer = bufferOf(engine)!;

      world.dispose();

      expect(shared.close).not.toHaveBeenCalled();
      expect(shared.state).toBe('running');
      expect(worldMaster.disconnect).toHaveBeenCalled();
      expect(worldBus.disconnect).toHaveBeenCalled();
      expect(engineBuffer.stopped).toBe(true);
      expect(engine.isPlaying).toBe(false);
      expect(ownerMaster.disconnect).not.toHaveBeenCalled();
      expect(ownerBus.disconnect).not.toHaveBeenCalled();
      expect(menuClick.isPlaying).toBe(true);
      expect(bufferOf(menuClick)!.stopped).toBe(false);
    });

    it('resolves its pending fades with false, and the owner still closes its context', async () => {
      const music = play(world);
      const done = jest.fn();
      music.fadeTo(0, 1000).then(done);
      world.dispose();
      await Promise.resolve();
      expect(done).toHaveBeenCalledWith(false);
      expect(jest.getTimerCount()).toBe(0);

      owner.dispose();
      expect(shared.close).toHaveBeenCalledTimes(1);
    });
  });

  it('binds no gesture listeners of its own (the owner unlocks the context)', async () => {
    const addSpy = jest.spyOn(window, 'addEventListener');
    await world.init();
    expect(addSpy.mock.calls.filter(c => RESUME_GESTURE_EVENTS.includes(c[0] as string))).toHaveLength(0);
    await owner.init();
    expect(addSpy.mock.calls.filter(c => c[0] === 'touchend')).toHaveLength(1);
    addSpy.mockRestore();
  });

  describe('setPaused', () => {
    it('pauses only its own sources, keeping their playheads, and never suspends the context', () => {
      const menuMusic = play(owner);
      const engine = play(world);
      const first = bufferOf(engine)!;
      engine.playbackRate = 2;
      advance(1.5); // 3 s of clip played

      world.setPaused(true);
      expect(shared.suspend).not.toHaveBeenCalled();
      expect(first.stopped).toBe(true);
      expect(engine.isPlaying).toBe(true);
      expect(bufferOf(menuMusic)!.stopped).toBe(false);

      advance(10); // the shared clock runs on while the world is paused
      world.setPaused(false);
      expect(shared.resume).not.toHaveBeenCalled();
      const second = bufferOf(engine)!;
      expect(second).not.toBe(first);
      expect(second.offset).toBeCloseTo(3);
      expect(second.stopped).toBe(false);

      advance(1);
      engine.pause();
      engine.play();
      expect(bufferOf(engine)!.offset).toBeCloseTo(5); // the paused 10 s don't count
    });

    it('starts a source played while paused on resume, from its start', () => {
      world.setPaused(true);
      advance(2);
      const horn = play(world, { loop: false });
      expect(horn.isPlaying).toBe(true);
      expect(world.voiceCounts.playing).toBe(1);
      expect(shared.bufferSources).toHaveLength(0);

      advance(3);
      world.setPaused(false);
      expect(shared.bufferSources).toHaveLength(1);
      expect(bufferOf(horn)!.offset).toBe(0);
    });

    it('resumes a source at the level it was heard at', () => {
      const engine = play(world, { volume: 0.6 });
      advance(1);
      world.setPaused(true);
      advance(5);
      world.setPaused(false);
      expect(gainOf(engine).valueAt(shared.currentTime)).toBeCloseTo(0.6);
    });

    it('holds a timed fade and its promise while paused, and continues it on resume', async () => {
      const music = play(world, { volume: 1 });
      const done = jest.fn();
      music.fadeTo(0, 1000).then(done);
      advance(0.5); // heard at 0.5

      world.setPaused(true);
      advance(10);
      await Promise.resolve();
      expect(done).not.toHaveBeenCalled();
      expect(music.volume).toBe(0);

      world.setPaused(false); // at t = 10.5
      const gain = gainOf(music);
      expect(gain.valueAt(10.5)).toBeCloseTo(0.5);
      expect(gain.valueAt(10.75)).toBeCloseTo(0.25);
      expect(gain.valueAt(11)).toBeCloseTo(0);

      advance(0.4);
      await Promise.resolve();
      expect(done).not.toHaveBeenCalled();
      advance(0.2);
      await Promise.resolve();
      expect(done).toHaveBeenCalledWith(true);
    });

    it('holds a fade of a source that is not playing too', async () => {
      const music = world.factory.createSource({ clip, autoplay: false, volume: 1 });
      const done = jest.fn();
      music.fadeTo(0, 1000).then(done);
      advance(0.5);
      world.setPaused(true);
      advance(10);
      await Promise.resolve();
      expect(done).not.toHaveBeenCalled();
      world.setPaused(false);
      music.play();
      expect(gainOf(music).valueAt(10.5)).toBeCloseTo(0.5);
      advance(0.6);
      await Promise.resolve();
      expect(done).toHaveBeenCalledWith(true);
    });

    it('starts a fade begun while paused on resume', async () => {
      const music = play(world, { volume: 1 });
      world.setPaused(true);
      advance(1);
      const done = jest.fn();
      music.fadeTo(0, 1000).then(done);
      advance(5);
      await Promise.resolve();
      expect(done).not.toHaveBeenCalled();
      world.setPaused(false); // at t = 6
      const gain = gainOf(music);
      expect(gain.valueAt(6)).toBeCloseTo(1);
      expect(gain.valueAt(6.5)).toBeCloseTo(0.5);
      advance(1.1);
      await Promise.resolve();
      expect(done).toHaveBeenCalledWith(true);
    });

    it('does not run virtual one-shots out while paused', () => {
      world.maxVoices = 1;
      play(world, { priority: 10 });
      const crash = play(world, { loop: false, priority: 0 });
      expect(crash.isVirtual).toBe(true);
      world.setPaused(true);
      advance(200); // longer than the clip
      expect(crash.isPlaying).toBe(true);
      world.setPaused(false);
      expect(crash.isPlaying).toBe(true);
    });

    it('keeps the voice budget while paused: a voice fading out goes virtual, an outranked one never starts', () => {
      world.maxVoices = 1;
      const ambience = play(world, { priority: 0 });
      const ambienceBuffer = bufferOf(ambience)!;
      const horn = play(world, { priority: 10 }); // takes the voice: ambience fading out
      expect(ambience.isVirtual).toBe(true);

      world.setPaused(true);
      expect(ambienceBuffer.stopped).toBe(true);
      const late = play(world, { priority: 5 }); // outranked while paused
      expect(late.isVirtual).toBe(true);
      horn.stop(); // frees the voice while paused
      advance(1);
      expect(shared.bufferSources.filter(b => !b.stopped)).toHaveLength(0);

      world.setPaused(false);
      jest.advanceTimersByTime(100); // the self-driven voice bookkeeping hands the voice over
      expect(late.isVirtual).toBe(false);
      expect(bufferOf(late)).not.toBeNull();
      expect(ambience.isVirtual).toBe(true);
    });

    it('leaves an owning scene suspending its context as before', () => {
      const music = play(owner);
      owner.setPaused(true);
      expect(shared.suspend).toHaveBeenCalledTimes(1);
      expect(bufferOf(music)!.stopped).toBe(false); // the suspended context holds it
      owner.setPaused(false);
      expect(shared.resume).toHaveBeenCalledTimes(1);
    });
  });

  it('writes the shared listener only from a scene with an active listener', () => {
    const camera = { position: { x: 1, y: 2, z: 3 }, rotation: { x: 0, y: 0, z: 0, w: 1 }, fov: 60 };
    owner.update(0, 16);
    expect(shared.listener.positionX.setValueAtTime).not.toHaveBeenCalled();
    expect(shared.listener.positionX.setTargetAtTime).not.toHaveBeenCalled();
    world.setActiveListener(camera as any);
    world.update(0, 16);
    expect(shared.listener.positionX.valueAt(0)).toBe(1);
    owner.update(0, 16);
    expect(shared.listener.positionX.setValueAtTime).toHaveBeenCalledTimes(1);
  });
});
