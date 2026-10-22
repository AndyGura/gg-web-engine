import { WebAudioScene2dComponent } from '../../src/components/web-audio-scene-2d.component';
import { WebAudioScene3dComponent } from '../../src/components/web-audio-scene-3d.component';
import { WebAudioSource3dComponent } from '../../src/components/web-audio-source-3d.component';
import { FADE_CATCH_UP_SECONDS, VIRTUAL_FADE_SECONDS } from '../../src/components/web-audio-source-base.component';

type AutomationEvent =
  | { type: 'set'; time: number; value: number }
  | { type: 'target'; time: number; value: number; tau: number }
  | { type: 'linear'; time: number; value: number };

/** Whether new fake params get `cancelAndHoldAtTime` (Chrome/Safari) or not (Firefox). */
let withCancelAndHold = false;

/**
 * An `AudioParam` that keeps its automation timeline and computes its value at any time from it, the
 * way the audio thread does, so a test can sample what is heard between and across writes.
 */
class FakeParam {
  public events: AutomationEvent[] = [];

  constructor(public value: number) {
    if (withCancelAndHold) {
      (this as any).cancelAndHoldAtTime = jest.fn((time: number) => {
        const level = this.valueAt(time);
        this.events = this.events.filter(e => e.time < time);
        this.insert({ type: 'set', time, value: level });
      });
    }
  }

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

  /** The param's value at context time `t`. */
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
  start = jest.fn();
  stop = jest.fn(() => {
    this.stopped = true;
  });
}

class FakeAudioContext {
  public state = 'running';
  public currentTime = 0;
  public destination = {};
  public onstatechange: (() => void) | null = null;
  public listener = Object.fromEntries(
    ['positionX', 'positionY', 'positionZ', 'forwardX', 'forwardY', 'forwardZ', 'upX', 'upY', 'upZ'].map(k => [
      k,
      new FakeParam(0),
    ]),
  );
  public bufferSources: FakeBufferSource[] = [];
  createGain = jest.fn(() => new FakeGainNode());
  createPanner = jest.fn(() => new FakePannerNode());
  createStereoPanner = jest.fn(() => new FakeStereoPannerNode());
  createBufferSource = jest.fn(() => {
    const node = new FakeBufferSource();
    this.bufferSources.push(node);
    return node;
  });
  resume = jest.fn(() => Promise.resolve());
  suspend = jest.fn(() => Promise.resolve());
  close = jest.fn(() => Promise.resolve());
}

type Internals = { gainNode: FakeGainNode; bufferSource: FakeBufferSource | null };

const clip = { duration: 100 } as unknown as AudioBuffer;

describe.each([
  ['without cancelAndHoldAtTime', false],
  ['with cancelAndHoldAtTime', true],
])('fadeTo (%s)', (_name, hold) => {
  let originalAudioContext: unknown;
  let scene: WebAudioScene3dComponent;
  let context: FakeAudioContext;

  const gainOf = (source: WebAudioSource3dComponent) => (source as unknown as Internals).gainNode.gain;

  function play(descriptor: { volume?: number; priority?: number } = {}): WebAudioSource3dComponent {
    const source = scene.factory.createSource({ clip, loop: true, autoplay: false, ...descriptor });
    source.play();
    return source;
  }

  /** advances the audio clock (and wall time by as much), then runs one scene tick */
  function advance(seconds: number) {
    context.currentTime += seconds;
    jest.advanceTimersByTime(seconds * 1000);
    scene.update(0, seconds * 1000);
  }

  /**
   * The gain heard at times spread across [from, to] - for asserting there is no jump. Sample only
   * from the current time on: a cancellation rewrites the timeline's past, which was already heard.
   */
  function sample(source: WebAudioSource3dComponent, from: number, to: number, steps = 50): number[] {
    return Array.from({ length: steps + 1 }, (_, i) => gainOf(source).valueAt(from + ((to - from) * i) / steps));
  }

  function maxStep(values: number[]): number {
    return Math.max(...values.slice(1).map((v, i) => Math.abs(v - values[i])));
  }

  beforeEach(() => {
    jest.useFakeTimers();
    withCancelAndHold = hold;
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

  it('ramps the gain linearly on the audio clock and reads back the target at once', async () => {
    const source = play({ volume: 1 });
    advance(1);
    const done = jest.fn();
    source.fadeTo(0.2, 2000).then(done);
    expect(source.volume).toBe(0.2);
    expect(gainOf(source).linearRampToValueAtTime).toHaveBeenLastCalledWith(0.2, 3);
    expect(gainOf(source).valueAt(2)).toBeCloseTo(0.6);
    expect(gainOf(source).valueAt(3)).toBeCloseTo(0.2);

    advance(1.5);
    await Promise.resolve();
    expect(done).not.toHaveBeenCalled();
    advance(0.6);
    await Promise.resolve();
    expect(done).toHaveBeenCalledWith(true);
  });

  it('waits while the audio clock stands still (a suspended context)', async () => {
    const source = play();
    const done = jest.fn();
    source.fadeTo(0, 500).then(done);
    scene.setPaused(true);
    jest.advanceTimersByTime(5000); // wall time passes, the context clock doesn't
    await Promise.resolve();
    expect(done).not.toHaveBeenCalled();
    scene.setPaused(false);
    advance(0.5);
    await Promise.resolve();
    expect(done).toHaveBeenCalledWith(true);
  });

  it('resolves false when another fade takes over, which starts from the level reached', async () => {
    const source = play({ volume: 1 });
    const first = jest.fn();
    source.fadeTo(0, 1000).then(first);
    advance(0.5);
    const before = sample(source, 0, 0.5);
    const second = jest.fn();
    source.fadeTo(1, 1000).then(second);
    await Promise.resolve();
    expect(first).toHaveBeenCalledWith(false);
    const heard = [...before, ...sample(source, 0.5, 1.5)];
    expect(maxStep(heard)).toBeLessThan(0.05); // down to 0.5 and back up, no jump
    expect(gainOf(source).valueAt(0.5)).toBeCloseTo(0.5);
    expect(gainOf(source).valueAt(1.5)).toBeCloseTo(1);
    advance(1);
    await Promise.resolve();
    expect(second).toHaveBeenCalledWith(true);
  });

  it('resolves false when the volume is written, which continues from the level reached', async () => {
    const source = play({ volume: 1 });
    const done = jest.fn();
    source.fadeTo(0, 1000).then(done);
    advance(0.5);
    const before = sample(source, 0.4, 0.5);
    source.volume = 0.8;
    await Promise.resolve();
    expect(done).toHaveBeenCalledWith(false);
    expect(source.volume).toBe(0.8);
    expect(gainOf(source).valueAt(0.5)).toBeCloseTo(0.5);
    expect(gainOf(source).valueAt(1)).toBeCloseTo(0.8, 2); // the fade's end event is gone
    expect(maxStep([...before, ...sample(source, 0.5, 0.6)])).toBeLessThan(0.05);
  });

  it('sets the volume at once for a duration of 0', async () => {
    const source = play({ volume: 1 });
    await expect(source.fadeTo(0.3, 0)).resolves.toBe(true);
    expect(source.volume).toBe(0.3);
    expect(gainOf(source).setTargetAtTime).toHaveBeenLastCalledWith(0.3, 0, expect.any(Number));
  });

  it('rejects a volume or a duration that is not a usable number', () => {
    const source = play();
    expect(() => source.fadeTo(-1, 100)).toThrow(RangeError);
    expect(() => source.fadeTo(NaN, 100)).toThrow(RangeError);
    expect(() => source.fadeTo(1, Infinity)).toThrow(RangeError);
  });

  it('resolves false on dispose', async () => {
    const source = play();
    const done = jest.fn();
    source.fadeTo(0, 1000).then(done);
    source.dispose();
    await Promise.resolve();
    expect(done).toHaveBeenCalledWith(false);
  });

  it('resolves false once the context is closed (the scene was disposed)', async () => {
    const source = play();
    const done = jest.fn();
    source.fadeTo(0, 1000).then(done);
    context.state = 'closed';
    jest.advanceTimersByTime(1000);
    await Promise.resolve();
    expect(done).toHaveBeenCalledWith(false);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('keeps running across stop() and play(): the replay is heard where the fade has got to', async () => {
    const source = play({ volume: 1 });
    source.fadeTo(0, 1000);
    advance(0.25);
    source.stop();
    advance(0.25);
    source.play();
    expect(gainOf(source).valueAt(0.5)).toBeCloseTo(0.5);
    expect(gainOf(source).valueAt(1)).toBeCloseTo(0);
  });

  describe('under a voice budget', () => {
    it('ranks a fading source by the level it is heard at, not by its target', () => {
      scene.maxVoices = 1;
      const music = play({ volume: 1 });
      music.fadeTo(0, 10000);
      advance(1); // heard at 0.9
      const other = play({ volume: 0.6 });
      expect(music.isVirtual).toBe(false);
      expect(other.isVirtual).toBe(true);
      advance(5); // music heard at 0.4 now: the other source takes the voice
      expect(music.isVirtual).toBe(true);
      expect(other.isVirtual).toBe(false);
    });

    it('fades out from where a fade is when made virtual, and schedules nothing while virtual', () => {
      scene.maxVoices = 1;
      const music = play({ volume: 0, priority: 0 });
      music.fadeTo(1, 2000);
      advance(1); // heard at 0.5
      const before = sample(music, 0.9, 1);
      play({ priority: 10 }); // takes the only voice
      expect(music.isVirtual).toBe(true);
      expect(maxStep([...before, ...sample(music, 1, 1.1)])).toBeLessThan(0.05);
      expect(gainOf(music).valueAt(1 + VIRTUAL_FADE_SECONDS)).toBeLessThan(0.01);
      advance(VIRTUAL_FADE_SECONDS + 0.01);
      const scheduled = gainOf(music).linearRampToValueAtTime.mock.calls.length;
      music.fadeTo(0.5, 1000);
      expect(gainOf(music).linearRampToValueAtTime.mock.calls.length).toBe(scheduled);
    });

    it('joins a fade where it has got to when heard again', () => {
      scene.maxVoices = 1;
      const music = play({ volume: 0 });
      music.fadeTo(1, 4000);
      const horn = play({ priority: 10 });
      advance(1); // music fully virtual
      horn.stop();
      advance(1); // promoted at t = 2, the fade at 0.5
      expect(music.isVirtual).toBe(false);
      const gain = gainOf(music);
      expect(gain.valueAt(2)).toBeCloseTo(0);
      expect(gain.valueAt(2 + FADE_CATCH_UP_SECONDS)).toBeCloseTo(0.5 + FADE_CATCH_UP_SECONDS / 4);
      expect(gain.valueAt(3)).toBeCloseTo(0.75);
      expect(gain.valueAt(4)).toBeCloseTo(1);
    });

    it('turns a source demoted mid-fade back up along the fade when promoted during its fade-out', () => {
      scene.maxVoices = 1;
      const music = play({ volume: 0 });
      music.fadeTo(1, 4000);
      advance(2); // heard at 0.5
      const horn = play({ priority: 10 });
      advance(0.05); // fading out
      horn.stop();
      scene.update(0, 0);
      expect(music.isVirtual).toBe(false);
      const gain = gainOf(music);
      expect(maxStep(sample(music, 2.04, 2.06))).toBeLessThan(0.05);
      expect(gain.valueAt(3)).toBeCloseTo(0.75);
      expect(gain.valueAt(4)).toBeCloseTo(1);
    });
  });
});

describe.each([
  ['3D', () => new WebAudioScene3dComponent()],
  ['2D', () => new WebAudioScene2dComponent()],
])('playOneShot (%s scene)', (_name, createScene) => {
  let originalAudioContext: unknown;
  let scene: WebAudioScene3dComponent | WebAudioScene2dComponent;
  let context: FakeAudioContext;

  beforeEach(() => {
    originalAudioContext = (global as any).AudioContext;
    (global as any).AudioContext = FakeAudioContext;
    scene = createScene();
    context = scene.context as unknown as FakeAudioContext;
  });

  afterEach(() => {
    scene.dispose();
    (global as any).AudioContext = originalAudioContext;
  });

  it('plays a non-positional, non-looping source on its bus and disposes it once it ends', () => {
    const source = scene.playOneShot({ clip, bus: 'ui', volume: 0.5 });
    expect(source.isPlaying).toBe(true);
    expect(source.spatial).toBe(false);
    expect(source.loop).toBe(false);
    expect(source.bus).toBe('ui');
    expect(source.volume).toBe(0.5);
    expect(context.bufferSources).toHaveLength(1);
    const dispose = jest.spyOn(source, 'dispose');
    context.bufferSources[0].onended!();
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(scene.voiceCounts.playing).toBe(0);
  });

  it('counts against the voice budget', () => {
    scene.maxVoices = 1;
    const first = scene.playOneShot({ clip, priority: 10 });
    const second = scene.playOneShot({ clip });
    expect(first.isVirtual).toBe(false);
    expect(second.isVirtual).toBe(true);
  });

  it('stops at once when the returned source is disposed', () => {
    const source = scene.playOneShot({ clip });
    source.dispose();
    expect(context.bufferSources[0].stopped).toBe(true);
    expect(scene.voiceCounts.playing).toBe(0);
  });
});
