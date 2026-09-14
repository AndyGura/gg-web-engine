import { WebAudioSceneComponentBase } from '../../src/components/web-audio-scene-base.component';

class FakeGainNode {
  public gain = { value: 1 };
  connect = jest.fn();
  disconnect = jest.fn();
}

class FakeAudioContext {
  public state: 'suspended' | 'running' | 'closed' = 'suspended';
  public destination = {};
  public onstatechange: (() => void) | null = null;
  createGain = jest.fn(() => new FakeGainNode());
  resume = jest.fn(() => {
    this.state = 'running';
    this.onstatechange?.();
    return Promise.resolve();
  });
  close = jest.fn(() => Promise.resolve());
}

class TestScene extends WebAudioSceneComponentBase<unknown, unknown> {
  constructor() {
    super();
  }

  update(): void {}
}

describe('WebAudioSceneComponentBase autoplay-resume listeners', () => {
  let originalAudioContext: unknown;

  beforeEach(() => {
    originalAudioContext = (global as any).AudioContext;
    (global as any).AudioContext = FakeAudioContext;
  });

  afterEach(() => {
    (global as any).AudioContext = originalAudioContext;
  });

  it('removes the pointerdown/keydown resume listeners on dispose if the gesture never fired', async () => {
    const addSpy = jest.spyOn(window, 'addEventListener');
    const removeSpy = jest.spyOn(window, 'removeEventListener');

    const scene = new TestScene();
    await scene.init();

    const pointerdownCall = addSpy.mock.calls.find(c => c[0] === 'pointerdown');
    const keydownCall = addSpy.mock.calls.find(c => c[0] === 'keydown');
    expect(pointerdownCall).toBeDefined();
    expect(keydownCall).toBeDefined();
    const resumeHandler = pointerdownCall![1];
    // both events share the exact same closure, per `init()`'s doc
    expect(keydownCall![1]).toBe(resumeHandler);

    scene.dispose();

    expect(removeSpy).toHaveBeenCalledWith('pointerdown', resumeHandler);
    expect(removeSpy).toHaveBeenCalledWith('keydown', resumeHandler);

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it('still removes the listeners once a real gesture resumes the context (onstatechange path)', async () => {
    const removeSpy = jest.spyOn(window, 'removeEventListener');
    const scene = new TestScene();
    await scene.init();

    // simulate a gesture firing `resume()`, which flips state to 'running' and fires onstatechange
    await (scene as unknown as { context: FakeAudioContext }).context.resume();

    expect(removeSpy).toHaveBeenCalledWith('pointerdown', expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function));

    removeSpy.mockRestore();
    scene.dispose();
  });
});
