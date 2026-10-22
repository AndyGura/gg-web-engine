import { Subject } from 'rxjs';
import { AudioSourceDescriptor } from '../../src';

/**
 * A hand-rolled audio source for the audio helpers' specs: records what it was asked to do, and
 * leaves each `fadeTo` pending until the test settles it (`settleFade`).
 */
export class FakeAudioSource {
  public volume: number;
  public isPlaying = false;
  public disposed = false;
  public readonly ended = new Subject<void>();
  public readonly ended$ = this.ended.asObservable();
  public readonly fades: { volume: number; durationMs: number; resolve: (reached: boolean) => void }[] = [];

  constructor(public readonly descriptor: AudioSourceDescriptor<unknown>) {
    this.volume = descriptor.volume ?? 1;
    if (descriptor.autoplay ?? true) {
      this.isPlaying = true;
    }
  }

  play = jest.fn(() => {
    this.isPlaying = true;
  });
  stop = jest.fn(() => {
    this.isPlaying = false;
  });
  dispose = jest.fn(() => {
    this.isPlaying = false;
    this.disposed = true;
    this.ended.complete();
  });
  fadeTo = jest.fn((volume: number, durationMs: number) => {
    this.volume = volume;
    return new Promise<boolean>(resolve => this.fades.push({ volume, durationMs, resolve }));
  });

  /** Resolves the last pending fade. */
  settleFade(reached = true) {
    this.fades.pop()!.resolve(reached);
  }

  /** Plays to its natural end. */
  end() {
    this.isPlaying = false;
    this.ended.next();
  }
}

/** A minimal audio scene: a factory whose clips are `{ url }` objects and whose sources are fakes. */
export function fakeAudioScene() {
  const sources: FakeAudioSource[] = [];
  const scene = {
    maxVoices: Infinity,
    factory: {
      loadClip: jest.fn((url: string) => Promise.resolve({ url })),
      createSource: jest.fn((descriptor: AudioSourceDescriptor<unknown>) => {
        const source = new FakeAudioSource(descriptor);
        sources.push(source);
        return source;
      }),
    },
  };
  return { scene: scene as any, sources, factory: scene.factory as any };
}

/** Lets pending promise callbacks run. */
export const flush = () => new Promise<void>(resolve => setTimeout(resolve, 0));
