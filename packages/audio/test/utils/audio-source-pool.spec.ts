import { Subject } from 'rxjs';
import { AudioSourcePool } from '../../src/utils/audio-source-pool';

type FakePosition = { x: number };

class FakeSource {
  public position: FakePosition = { x: 0 };
  public rotation = 0;
  public playing = false;
  public stopCallCount = 0;
  public readonly ended$ = new Subject<void>();

  play(): void {
    this.playing = true;
  }

  stop(): void {
    this.stopCallCount++;
    this.playing = false;
  }

  end(): void {
    this.playing = false;
    this.ended$.next();
  }
}

function fakeScene(createdSources: FakeSource[]) {
  return {
    factory: {
      createSource: jest.fn(() => {
        const source = new FakeSource();
        createdSources.push(source);
        return source;
      }),
    },
  } as any;
}

describe('AudioSourcePool', () => {
  it('creates a fresh voice on first play, up to one per call while none are free', () => {
    const created: FakeSource[] = [];
    const pool = new AudioSourcePool(fakeScene(created), { clip: {} }, 4);

    pool.play({ x: 1 });
    pool.play({ x: 2 });
    pool.play({ x: 3 });

    expect(created).toHaveLength(3);
    expect(created.map(s => s.position.x)).toEqual([1, 2, 3]);
    expect(created.every(s => s.playing)).toBe(true);
  });

  it('reuses a voice once it finishes playing instead of allocating a new one', () => {
    const created: FakeSource[] = [];
    const pool = new AudioSourcePool(fakeScene(created), { clip: {} }, 4);

    pool.play({ x: 1 });
    expect(created).toHaveLength(1);
    created[0].end(); // simulate playback finishing (ended$ fires)

    pool.play({ x: 2 });
    expect(created).toHaveLength(1); // no new voice allocated
    expect(created[0].position.x).toBe(2);
    expect(created[0].playing).toBe(true);
  });

  it('steals the least-recently-used voice once the pool is full', () => {
    const created: FakeSource[] = [];
    const pool = new AudioSourcePool(fakeScene(created), { clip: {} }, 2);

    pool.play({ x: 1 }); // voice 0, still "busy" (never ended)
    pool.play({ x: 2 }); // voice 1, still "busy"
    expect(created).toHaveLength(2);

    pool.play({ x: 3 }); // pool full, both busy -> steals the oldest (voice 0)

    expect(created).toHaveLength(2); // no third voice allocated
    expect(created[0].stopCallCount).toBe(1); // the stolen voice was stopped first
    expect(created[0].position.x).toBe(3); // ...then repurposed for the new play() call
  });

  it('passes rotation through to the voice when given', () => {
    const created: FakeSource[] = [];
    const pool = new AudioSourcePool(fakeScene(created), { clip: {} }, 4);

    pool.play({ x: 1 }, 2.5);

    expect(created[0].rotation).toBe(2.5);
  });

  it('disposes every voice it ever created', () => {
    const created: FakeSource[] = [];
    const disposeSpy = jest.fn();
    const scene = fakeScene(created);
    scene.factory.createSource = jest.fn(() => {
      const source = new FakeSource();
      (source as any).dispose = disposeSpy;
      created.push(source);
      return source;
    });
    const pool = new AudioSourcePool(scene, { clip: {} }, 4);

    pool.play({ x: 1 });
    pool.play({ x: 2 });
    pool.dispose();

    expect(disposeSpy).toHaveBeenCalledTimes(2);
  });
});
