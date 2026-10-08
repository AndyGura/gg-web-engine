import { DEFAULT_AUDIO_REVERB } from '@gg-web-engine/core';
import { WebAudioScene2dComponent } from '../../src/components/web-audio-scene-2d.component';
import { WebAudioScene3dComponent } from '../../src/components/web-audio-scene-3d.component';
import { REVERB_RELEASE_SECONDS } from '../../src/components/web-audio-scene-base.component';

class FakeParam {
  /** where the last ramp (or jump) is heading */
  public target: number;
  public ramps = 0;

  constructor(public value: number) {
    this.target = value;
  }

  setTargetAtTime = jest.fn((value: number) => {
    this.target = value;
    this.ramps++;
  });
  setValueAtTime = jest.fn((value: number) => {
    this.value = value;
    this.target = value;
  });
  cancelScheduledValues = jest.fn();
}

/** A node that records its outgoing connections, so tests can tell what is in the rendered graph. */
class FakeNode {
  public outputs = new Set<FakeNode | object>();
  connect = jest.fn((destination: FakeNode | object) => {
    this.outputs.add(destination);
    return destination;
  });
  disconnect = jest.fn((destination?: FakeNode | object) => {
    if (destination) {
      this.outputs.delete(destination);
    } else {
      this.outputs.clear();
    }
  });
}

class FakeGainNode extends FakeNode {
  public gain = new FakeParam(1);
}

class FakeConvolverNode extends FakeNode {
  public buffer: FakeAudioBuffer | null = null;
  public normalize = true;
}

class FakeAudioBuffer {
  private readonly data: Float32Array[];

  constructor(
    public numberOfChannels: number,
    public length: number,
    public sampleRate: number,
  ) {
    this.data = Array.from({ length: numberOfChannels }, () => new Float32Array(length));
  }

  getChannelData(channel: number): Float32Array {
    return this.data[channel];
  }
}

class FakeAudioContext {
  public state = 'running';
  public currentTime = 0;
  public sampleRate = 8000;
  public destination = {};
  public onstatechange: (() => void) | null = null;
  public listener = Object.fromEntries(
    ['positionX', 'positionY', 'positionZ', 'forwardX', 'forwardY', 'forwardZ', 'upX', 'upY', 'upZ'].map(k => [
      k,
      new FakeParam(0),
    ]),
  );
  public convolvers: FakeConvolverNode[] = [];
  createGain = jest.fn(() => new FakeGainNode());
  createConvolver = jest.fn(() => {
    const node = new FakeConvolverNode();
    this.convolvers.push(node);
    return node;
  });
  createBuffer = jest.fn(
    (channels: number, length: number, rate: number) => new FakeAudioBuffer(channels, length, rate),
  );
  resume = jest.fn(() => Promise.resolve());
  suspend = jest.fn(() => Promise.resolve());
  close = jest.fn(() => Promise.resolve());
}

type SceneInternals = {
  masterGain: FakeGainNode;
  buses: Map<
    string,
    { input: FakeGainNode; dry: FakeGainNode; reverb: { chain: { wet: FakeGainNode } | null } | null }
  >;
};

describe.each([
  ['3D', () => new WebAudioScene3dComponent()],
  ['2D', () => new WebAudioScene2dComponent()],
])('bus reverb (%s scene)', (_name, createScene) => {
  let originalAudioContext: unknown;
  let scene: WebAudioScene3dComponent | WebAudioScene2dComponent;
  let context: FakeAudioContext;

  const internals = () => scene as unknown as SceneInternals;
  const bus = (name: string) => internals().buses.get(name)!;
  /** whether `node` feeds the master gain, directly or through other nodes */
  const reachesMaster = (node: FakeNode): boolean =>
    [...node.outputs].some(o => o === internals().masterGain || (o instanceof FakeNode && reachesMaster(o)));
  /** convolvers fed by the bus and heard */
  const liveConvolvers = (name: string) =>
    context.convolvers.filter(c => bus(name).input.outputs.has(c) && reachesMaster(c));

  function tick(seconds: number) {
    context.currentTime += seconds;
    scene.update(0, seconds * 1000);
  }

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

  it('has no reverb by default: the bus feeds the master gain through its dry gain only', () => {
    expect(scene.getBusReverb('sfx')).toBeNull();
    scene.getBusNode('sfx');
    const sfx = bus('sfx');
    expect(sfx.input.outputs).toEqual(new Set([sfx.dry]));
    expect(sfx.dry.outputs).toEqual(new Set([internals().masterGain]));
    expect(context.createConvolver).not.toHaveBeenCalled();
  });

  it('puts one convolver on the bus, after its volume, with a generated stereo impulse response', () => {
    scene.setBusReverb('sfx', { wet: 0.4, decay: 1, preDelay: 0.05 });
    expect(scene.getBusReverb('sfx')).toEqual({ ...DEFAULT_AUDIO_REVERB, wet: 0.4, decay: 1, preDelay: 0.05 });
    expect(liveConvolvers('sfx')).toHaveLength(1);
    const [convolver] = liveConvolvers('sfx');
    expect(convolver.buffer!.numberOfChannels).toBe(2);
    expect(convolver.buffer!.length).toBe(Math.ceil(1.05 * context.sampleRate));
    // wet gain starts silent and ramps up
    expect(bus('sfx').reverb!.chain!.wet.gain.value).toBe(0);
    expect(bus('sfx').reverb!.chain!.wet.gain.target).toBe(0.4);
    // other buses are untouched
    scene.getBusNode('music');
    expect(liveConvolvers('music')).toHaveLength(0);
  });

  it('ramps wet/dry changes on the same convolver, and skips writes that change nothing', () => {
    scene.setBusReverb('sfx', { wet: 0.1 });
    const wet = bus('sfx').reverb!.chain!.wet;
    for (const level of [0.2, 0.3, 0.4]) {
      tick(1 / 60);
      scene.setBusReverb('sfx', { wet: level, dry: 0.8 });
      expect(wet.gain.target).toBe(level);
    }
    expect(bus('sfx').dry.gain.target).toBe(0.8);
    expect(context.createConvolver).toHaveBeenCalledTimes(1);
    expect(context.createBuffer).toHaveBeenCalledTimes(1);
    const ramps = wet.gain.ramps;
    const dryRamps = bus('sfx').dry.gain.ramps;
    scene.setBusReverb('sfx', { wet: 0.4, dry: 0.8 });
    expect(wet.gain.ramps).toBe(ramps);
    expect(bus('sfx').dry.gain.ramps).toBe(dryRamps);
  });

  it('at wet 0 fades the convolver out, then disconnects it; fading in again creates a fresh one', () => {
    scene.setBusReverb('sfx', { wet: 0.5 });
    const first = liveConvolvers('sfx')[0];
    const firstWet = bus('sfx').reverb!.chain!.wet;

    scene.setBusReverb('sfx', { wet: 0 });
    expect(firstWet.gain.target).toBe(0);
    expect(scene.getBusReverb('sfx')!.wet).toBe(0);
    tick(REVERB_RELEASE_SECONDS / 2);
    expect(liveConvolvers('sfx')).toEqual([first]);
    tick(REVERB_RELEASE_SECONDS);
    expect(liveConvolvers('sfx')).toHaveLength(0);
    expect(first.outputs.size).toBe(0);
    expect(firstWet.outputs.size).toBe(0);
    // the bus still sounds through its dry path
    expect(bus('sfx').dry.outputs).toEqual(new Set([internals().masterGain]));

    scene.setBusReverb('sfx', { wet: 0.5 });
    expect(liveConvolvers('sfx')).toHaveLength(1);
    expect(liveConvolvers('sfx')[0]).not.toBe(first);
    // same shape: the impulse response is reused, not regenerated
    expect(context.createBuffer).toHaveBeenCalledTimes(1);
    expect(liveConvolvers('sfx')[0].buffer).toBe(first.buffer);
  });

  it('takes the releasing convolver back when wet rises again before it is disconnected', () => {
    scene.setBusReverb('sfx', { wet: 0.5 });
    const first = liveConvolvers('sfx')[0];
    scene.setBusReverb('sfx', { wet: 0 });
    tick(REVERB_RELEASE_SECONDS / 2);
    scene.setBusReverb('sfx', { wet: 0.3 });
    expect(context.createConvolver).toHaveBeenCalledTimes(1);
    expect(bus('sfx').reverb!.chain!.wet.gain.target).toBe(0.3);
    tick(REVERB_RELEASE_SECONDS * 2);
    expect(liveConvolvers('sfx')).toEqual([first]);
  });

  it('builds the impulse response when given at wet 0, without a convolver', () => {
    scene.setBusReverb('sfx', { wet: 0, decay: 2 });
    expect(context.createBuffer).toHaveBeenCalledTimes(1);
    expect(context.createConvolver).not.toHaveBeenCalled();
    scene.setBusReverb('sfx', { wet: 0.2, decay: 2 });
    expect(context.createBuffer).toHaveBeenCalledTimes(1);
    expect(liveConvolvers('sfx')).toHaveLength(1);
  });

  it('crossfades to a rebuilt convolver when the shape changes', () => {
    scene.setBusReverb('sfx', { wet: 0.5, decay: 1 });
    const first = liveConvolvers('sfx')[0];
    scene.setBusReverb('sfx', { wet: 0.5, decay: 2 });
    expect(context.createBuffer).toHaveBeenCalledTimes(2);
    const live = liveConvolvers('sfx');
    expect(live).toHaveLength(2);
    const second = live.find(c => c !== first)!;
    expect(second.buffer!.length).toBe(2 * context.sampleRate + Math.ceil(0.02 * context.sampleRate));
    tick(REVERB_RELEASE_SECONDS * 2);
    expect(liveConvolvers('sfx')).toEqual([second]);
  });

  it('null fades the reverb out, restores dry to 1 and forgets the settings', () => {
    scene.setBusReverb('sfx', { wet: 0.5, dry: 0.5 });
    scene.setBusReverb('sfx', null);
    expect(scene.getBusReverb('sfx')).toBeNull();
    expect(bus('sfx').dry.gain.target).toBe(1);
    tick(REVERB_RELEASE_SECONDS * 2);
    expect(liveConvolvers('sfx')).toHaveLength(0);
    // null on a bus without a reverb does nothing, not even creating the bus
    scene.setBusReverb('ambient', null);
    expect(internals().buses.has('ambient')).toBe(false);
  });

  it('rejects settings out of range without touching the bus', () => {
    scene.setBusReverb('sfx', { wet: 0.5 });
    expect(() => scene.setBusReverb('sfx', { wet: -1 })).toThrow(RangeError);
    expect(scene.getBusReverb('sfx')!.wet).toBe(0.5);
  });

  it('disconnects every reverb chain on dispose', () => {
    scene.setBusReverb('sfx', { wet: 0.5 });
    scene.setBusReverb('music', { wet: 0.5 });
    scene.setBusReverb('music', { wet: 0 });
    const [a, b] = context.convolvers;
    scene.dispose();
    expect(a.outputs.size).toBe(0);
    expect(b.outputs.size).toBe(0);
  });
});
