import { Subject } from 'rxjs';
import { GgWorld, IEntity, PlaySoundBlueprintNode, TickOrder } from '../../../src';

class TestEntity extends IEntity {
  public readonly tickOrder = TickOrder.OBJECTS_BINDING;
  public position = { x: 42 };
}

class FakeAudioSource {
  public position: any;
  public rotation: any;
  public readonly ended$ = new Subject<void>();
  public playCalled = false;
  public disposeCalled = false;

  play(): void {
    this.playCalled = true;
  }

  dispose(): void {
    this.disposeCalled = true;
  }

  end(): void {
    this.ended$.next();
  }
}

function fakeAudioScene() {
  const createdSources: FakeAudioSource[] = [];
  return {
    scene: {
      factory: {
        loadClip: jest.fn((url: string) => Promise.resolve(`decoded:${url}`)),
        createSource: jest.fn((descriptor: any) => {
          const source = new FakeAudioSource();
          (source as any).descriptor = descriptor;
          createdSources.push(source);
          return source;
        }),
      },
    },
    createdSources,
  };
}

class MockWorldWithAudio extends GgWorld<any, any> {
  constructor(audioScene: any = null) {
    super({
      visualScene: { init: async () => {}, dispose: () => {} } as any,
      physicsWorld: { init: async () => {}, simulate: () => {}, dispose: () => {} } as any,
      audioScene,
    });
  }

  addPrimitiveRigidBody(): any {
    return undefined;
  }
}

describe('PlaySoundBlueprintNode', () => {
  it('declares one data input pin ("trigger") and no output pins', () => {
    const world = new MockWorldWithAudio();
    const node = new PlaySoundBlueprintNode(world, { clip: 'sfx/pop.mp3' });
    expect(node.inputs).toEqual([{ name: 'trigger', kind: 'data' }]);
    expect(node.outputs).toEqual([]);
  });

  it('warns and does nothing when the world has no audioScene', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const world = new MockWorldWithAudio(null);
    const node = new PlaySoundBlueprintNode(world, { clip: 'sfx/pop.mp3' });

    node.trigger('trigger', {});

    expect(warnSpy).toHaveBeenCalledWith(
      'PlaySound blueprint node triggered, but this world has no audioScene - ignoring',
    );
    warnSpy.mockRestore();
  });

  it('warns and does nothing when no "clip" setting is configured', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { scene } = fakeAudioScene();
    const world = new MockWorldWithAudio(scene);
    const node = new PlaySoundBlueprintNode(world, {});

    node.trigger('trigger', {});

    expect(warnSpy).toHaveBeenCalledWith('PlaySound blueprint node has no "clip" setting - ignoring');
    expect(scene.factory.loadClip).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('ignores triggers on unknown input pins', () => {
    const { scene } = fakeAudioScene();
    const world = new MockWorldWithAudio(scene);
    const node = new PlaySoundBlueprintNode(world, { clip: 'sfx/pop.mp3' });

    node.trigger('somethingElse', {});

    expect(scene.factory.loadClip).not.toHaveBeenCalled();
  });

  it('loads the clip, creates a non-looping source and plays it', async () => {
    const { scene, createdSources } = fakeAudioScene();
    const world = new MockWorldWithAudio(scene);
    const node = new PlaySoundBlueprintNode(world, { clip: 'sfx/pop.mp3', volume: 0.5, bus: 'sfx' });

    node.trigger('trigger', {});
    await Promise.resolve();
    await Promise.resolve();

    expect(scene.factory.loadClip).toHaveBeenCalledWith('sfx/pop.mp3');
    expect(createdSources).toHaveLength(1);
    expect(createdSources[0].playCalled).toBe(true);
    expect((createdSources[0] as any).descriptor).toMatchObject({
      clip: 'decoded:sfx/pop.mp3',
      loop: false,
      autoplay: false,
      volume: 0.5,
      bus: 'sfx',
    });
  });

  it("uses the triggering payload's own position when settings.position isn't set", async () => {
    const { scene, createdSources } = fakeAudioScene();
    const world = new MockWorldWithAudio(scene);
    const node = new PlaySoundBlueprintNode(world, { clip: 'sfx/pop.mp3' });

    const payload = new TestEntity();
    node.trigger('trigger', payload);
    await Promise.resolve();
    await Promise.resolve();

    expect(createdSources[0].position).toEqual({ x: 42 });
  });

  it('prefers a fixed settings.position over the payload position', async () => {
    const { scene, createdSources } = fakeAudioScene();
    const world = new MockWorldWithAudio(scene);
    const node = new PlaySoundBlueprintNode(world, { clip: 'sfx/pop.mp3', position: { x: 7 } });

    node.trigger('trigger', new TestEntity());
    await Promise.resolve();
    await Promise.resolve();

    expect(createdSources[0].position).toEqual({ x: 7 });
  });

  it('disposes the source once playback ends', async () => {
    const { scene, createdSources } = fakeAudioScene();
    const world = new MockWorldWithAudio(scene);
    const node = new PlaySoundBlueprintNode(world, { clip: 'sfx/pop.mp3' });

    node.trigger('trigger', {});
    await Promise.resolve();
    await Promise.resolve();

    expect(createdSources[0].disposeCalled).toBe(false);
    createdSources[0].end();
    expect(createdSources[0].disposeCalled).toBe(true);
  });
});
