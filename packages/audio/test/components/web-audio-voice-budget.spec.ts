import { Point3 } from '@gg-web-engine/core';
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
