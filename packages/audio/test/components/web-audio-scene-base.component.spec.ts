import { WebAudioSceneComponentBase } from '../../src/components/web-audio-scene-base.component';

class FakeGainNode {
  public gain = { value: 1 };
  connect = jest.fn();
  disconnect = jest.fn();
}

class FakeBufferSource {
  public buffer: unknown = null;
  public onended: (() => void) | null = null;
  connect = jest.fn();
  disconnect = jest.fn();
  start = jest.fn();
}

type FakeState = 'suspended' | 'running' | 'closed' | 'interrupted';

class FakeAudioContext {
  public state: FakeState = 'suspended';
  public sampleRate = 44100;
  public destination = {};
  public onstatechange: (() => void) | null = null;
  /** What `resume()` turns the state into - a browser that refuses the gesture keeps it as is. */
  public resumeTo: FakeState = 'running';
  public readonly bufferSources: FakeBufferSource[] = [];
  createGain = jest.fn(() => new FakeGainNode());
  createBuffer = jest.fn((channels: number, length: number, sampleRate: number) => ({ channels, length, sampleRate }));
  createBufferSource = jest.fn(() => {
    const source = new FakeBufferSource();
    this.bufferSources.push(source);
    return source;
  });
  resume = jest.fn(() => {
    this.state = this.resumeTo;
    this.onstatechange?.();
    return Promise.resolve();
  });
  suspend = jest.fn(() => {
    this.state = 'suspended';
    return Promise.resolve();
  });
  decodeAudioData = jest.fn((data: ArrayBuffer) => Promise.resolve({ decodedBytes: data.byteLength }));
  close = jest.fn(() => {
    this.state = 'closed';
    return Promise.resolve();
  });
}

class TestScene extends WebAudioSceneComponentBase<unknown, unknown> {
  constructor() {
    super();
  }

  update(): void {}
}

describe('WebAudioSceneComponentBase autoplay-resume listeners', () => {
  let originalAudioContext: unknown;
  const contextOf = (scene: TestScene) => (scene as unknown as { context: FakeAudioContext }).context;
  /** A tap on the page as a phone delivers it. */
  const tap = (target: EventTarget = document.body) => {
    for (const type of ['pointerdown', 'pointerup', 'touchend', 'click']) {
      target.dispatchEvent(new Event(type, { bubbles: true }));
    }
  };

  beforeEach(() => {
    originalAudioContext = (global as any).AudioContext;
    (global as any).AudioContext = FakeAudioContext;
  });

  afterEach(() => {
    (global as any).AudioContext = originalAudioContext;
    document.body.innerHTML = '';
  });

  it('resumes a suspended context on a gesture and plays a silent buffer within it', async () => {
    const scene = new TestScene();
    await scene.init();
    const context = contextOf(scene);

    window.dispatchEvent(new Event('keydown'));

    expect(context.resume).toHaveBeenCalledTimes(1);
    expect(context.state).toBe('running');
    expect(context.bufferSources).toHaveLength(1);
    const [unlock] = context.bufferSources;
    expect(unlock.connect).toHaveBeenCalledWith(context.destination);
    expect(unlock.start).toHaveBeenCalled();
    expect(context.createBuffer).toHaveBeenCalledWith(1, 1, context.sampleRate);

    // a running context is left alone
    tap();
    expect(context.resume).toHaveBeenCalledTimes(1);
    expect(context.bufferSources).toHaveLength(1);
    scene.dispose();
  });

  it('resumes a context that starts interrupted (WebKit, created without a gesture)', async () => {
    const scene = new TestScene();
    const context = contextOf(scene);
    context.state = 'interrupted';
    await scene.init();

    tap();

    expect(context.resume).toHaveBeenCalled();
    expect(context.state).toBe('running');
    scene.dispose();
  });

  it('sees a gesture whose propagation a control stops (capture phase)', async () => {
    const scene = new TestScene();
    await scene.init();
    const context = contextOf(scene);
    const control = document.createElement('div');
    document.body.appendChild(control);
    for (const type of ['pointerdown', 'pointerup', 'touchend', 'click']) {
      control.addEventListener(type, event => event.stopPropagation());
    }

    tap(control);

    expect(context.resume).toHaveBeenCalled();
    expect(context.state).toBe('running');
    scene.dispose();
  });

  it('keeps trying on later gestures when the browser refuses one', async () => {
    const scene = new TestScene();
    await scene.init();
    const context = contextOf(scene);
    context.resumeTo = 'suspended';

    // iOS: pointerdown is not an accepted gesture for audio
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(context.state).toBe('suspended');

    context.resumeTo = 'running';
    document.body.dispatchEvent(new Event('touchend', { bubbles: true }));
    expect(context.state).toBe('running');
    scene.dispose();
  });

  it('resumes a context interrupted again later on the next gesture', async () => {
    const scene = new TestScene();
    await scene.init();
    const context = contextOf(scene);
    tap();
    expect(context.state).toBe('running');
    const resumes = context.resume.mock.calls.length;

    // a phone call, another app's audio, the app in the background
    context.state = 'interrupted';
    tap();

    expect(context.resume.mock.calls.length).toBeGreaterThan(resumes);
    expect(context.state).toBe('running');
    scene.dispose();
  });

  it('removes every gesture listener on dispose', async () => {
    const addSpy = jest.spyOn(window, 'addEventListener');
    const removeSpy = jest.spyOn(window, 'removeEventListener');

    const scene = new TestScene();
    await scene.init();
    const added = addSpy.mock.calls.filter(c => c[1] === addSpy.mock.calls[0][1]);
    expect(added.map(c => c[0]).sort()).toEqual(['click', 'keydown', 'pointerdown', 'pointerup', 'touchend']);
    for (const [, , options] of added) {
      expect(options).toEqual({ capture: true, passive: true });
    }

    scene.dispose();

    for (const [type, handler] of added) {
      expect(removeSpy).toHaveBeenCalledWith(type, handler, { capture: true, passive: true });
    }
    // a disposed scene no longer reacts
    const context = contextOf(scene);
    context.state = 'suspended';
    tap();
    expect(context.resume).not.toHaveBeenCalled();

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it('binds its listeners once however often init() runs', async () => {
    const addSpy = jest.spyOn(window, 'addEventListener');
    const scene = new TestScene();
    await scene.init();
    await scene.init();
    expect(addSpy.mock.calls.filter(c => c[0] === 'pointerdown')).toHaveLength(1);
    addSpy.mockRestore();
    scene.dispose();
  });
});

describe('WebAudioSceneComponentBase pause and decoding', () => {
  let originalAudioContext: unknown;
  const contextOf = (scene: TestScene) => (scene as unknown as { context: FakeAudioContext }).context;

  beforeEach(() => {
    originalAudioContext = (global as any).AudioContext;
    (global as any).AudioContext = FakeAudioContext;
  });

  afterEach(() => {
    (global as any).AudioContext = originalAudioContext;
  });

  it('suspends the context while paused and resumes it afterwards', () => {
    const scene = new TestScene();
    const context = contextOf(scene);
    context.state = 'running';

    scene.setPaused(true);
    expect(context.suspend).toHaveBeenCalledTimes(1);
    scene.setPaused(true);
    expect(context.suspend).toHaveBeenCalledTimes(1);

    scene.setPaused(false);
    expect(context.resume).toHaveBeenCalledTimes(1);
    scene.dispose();
  });

  it('does not let a gesture wake a scene that is paused, and resumes on one after unpausing', async () => {
    const scene = new TestScene();
    await scene.init();
    const context = contextOf(scene);
    context.state = 'interrupted';

    scene.setPaused(true);
    context.resume.mockClear();
    window.dispatchEvent(new Event('click'));
    expect(context.resume).not.toHaveBeenCalled();
    expect(context.bufferSources).toHaveLength(0);

    // unpausing outside a gesture: the browser refuses
    context.resumeTo = 'interrupted';
    scene.setPaused(false);
    expect(context.resume).toHaveBeenCalledTimes(1);
    expect(context.state).toBe('interrupted');

    context.resumeTo = 'running';
    window.dispatchEvent(new Event('click'));
    expect(context.resume).toHaveBeenCalledTimes(2);
    expect(context.state).toBe('running');
    scene.dispose();
  });

  it('decodeClip decodes bytes that were fetched elsewhere, without fetching', async () => {
    const scene = new TestScene();
    const clip = await scene.decodeClip(new ArrayBuffer(12));
    expect(clip).toEqual({ decodedBytes: 12 });
    expect(contextOf(scene).decodeAudioData).toHaveBeenCalledTimes(1);
    scene.dispose();
  });
});
