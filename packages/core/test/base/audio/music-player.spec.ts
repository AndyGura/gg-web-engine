import { MusicPlayer, MusicTrack } from '../../../src';
import { fakeAudioScene, flush } from '../../mocks/audio-scene.mock';

type Track = MusicTrack & { title: string };

const track = (title: string, extra: Partial<MusicTrack> = {}): Track => ({ url: `${title}.ogg`, title, ...extra });

/** A deterministic random source in [0, 1). */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

describe('MusicPlayer', () => {
  let warn: jest.SpyInstance;

  beforeEach(() => {
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warn.mockRestore();
  });

  it('plays a track on the music bus, non-positional, fading it in', async () => {
    const { scene, sources, factory } = fakeAudioScene();
    const player = new MusicPlayer<Track>(scene);
    const menu = track('menu', { volume: 0.8 });
    const seen: (Track | null)[] = [];
    player.nowPlaying$.subscribe(t => seen.push(t));

    await player.play(menu);

    expect(factory.loadClip).toHaveBeenCalledWith('menu.ogg');
    expect(sources).toHaveLength(1);
    const source = sources[0];
    expect(source.descriptor).toEqual(
      expect.objectContaining({
        clip: { url: 'menu.ogg' },
        bus: 'music',
        spatial: false,
        autoplay: false,
        priority: Infinity,
        loop: false,
        volume: 0,
      }),
    );
    expect(source.play).toHaveBeenCalled();
    expect(source.fadeTo).toHaveBeenCalledWith(0.8, 1000);
    expect(player.nowPlaying).toBe(menu);
    expect(seen).toEqual([null, menu]);
  });

  it('crossfades into the next playlist and releases the old track once faded out', async () => {
    const { scene, sources } = fakeAudioScene();
    const player = new MusicPlayer<Track>(scene, { crossfadeMs: 500 });
    await player.play(track('a'));
    await player.play(track('b'), { crossfadeMs: 2000 });

    const [a, b] = sources;
    expect(a.fadeTo).toHaveBeenLastCalledWith(0, 2000);
    expect(b.fadeTo).toHaveBeenCalledWith(1, 2000);
    expect(a.stop).not.toHaveBeenCalled();
    a.settleFade();
    await flush();
    expect(a.stop).toHaveBeenCalled();
    expect(a.dispose).toHaveBeenCalled();
    expect(b.disposed).toBe(false);
  });

  it('keeps the current track playing while the next one loads, and drops a load another command replaced', async () => {
    const { scene, sources, factory } = fakeAudioScene();
    const player = new MusicPlayer<Track>(scene);
    await player.play(track('a'));
    let finishLoad!: (clip: any) => void;
    factory.loadClip.mockImplementationOnce(() => new Promise(resolve => (finishLoad = resolve)));

    const slow = player.play(track('slow'));
    await flush();
    expect(sources[0].fadeTo).toHaveBeenCalledTimes(1); // only its fade-in: still playing
    await player.play(track('c'));
    finishLoad({ url: 'slow.ogg' });
    await slow;

    expect(sources.map(s => s.descriptor.clip)).toEqual([{ url: 'a.ogg' }, { url: 'c.ogg' }]);
    expect(player.nowPlaying!.title).toBe('c');
  });

  it('moves on to the next track at the end of one, at full volume', async () => {
    const { scene, sources } = fakeAudioScene();
    const player = new MusicPlayer<Track>(scene);
    const [a, b] = [track('a', { volume: 0.5 }), track('b', { volume: 0.7 })];
    await player.play([a, b]);
    sources[0].end();
    await flush();

    expect(sources[0].dispose).toHaveBeenCalled();
    expect(sources[1].descriptor.volume).toBe(0.7);
    expect(sources[1].fadeTo).not.toHaveBeenCalled();
    expect(player.nowPlaying).toBe(b);

    sources[1].end(); // repeat (the default): the first track again
    await flush();
    expect(player.nowPlaying).toBe(a);
  });

  it('stops after the last track without repeat', async () => {
    const { scene, sources } = fakeAudioScene();
    const player = new MusicPlayer<Track>(scene);
    await player.play([track('a'), track('b')], { repeat: false });
    sources[0].end();
    await flush();
    sources[1].end();
    await flush();
    expect(sources).toHaveLength(2);
    expect(player.nowPlaying).toBeNull();
    expect(player.playlist).toEqual([]);
  });

  it('loops a track marked loop, with its loop region', async () => {
    const { scene, sources } = fakeAudioScene();
    const player = new MusicPlayer<Track>(scene);
    await player.play(track('a', { loop: true, loopStart: 2, loopEnd: 30 }));
    expect(sources[0].descriptor).toEqual(expect.objectContaining({ loop: true, loopStart: 2, loopEnd: 30 }));
  });

  it('next() crossfades to the next track, wrapping around', async () => {
    const { scene, sources } = fakeAudioScene();
    const player = new MusicPlayer<Track>(scene);
    const tracks = [track('a'), track('b')];
    await player.play(tracks, { crossfadeMs: 300 });
    await player.next();
    expect(sources[0].fadeTo).toHaveBeenLastCalledWith(0, 300);
    expect(player.nowPlaying).toBe(tracks[1]);
    await player.next(50);
    expect(sources[1].fadeTo).toHaveBeenLastCalledWith(0, 50);
    expect(player.nowPlaying).toBe(tracks[0]);
  });

  it('stop() fades out, forgets the playlist and reports silence at once', async () => {
    const { scene, sources } = fakeAudioScene();
    const player = new MusicPlayer<Track>(scene);
    await player.play([track('a'), track('b')], { crossfadeMs: 400 });
    const done = jest.fn();
    player.stop().then(done);
    expect(player.nowPlaying).toBeNull();
    expect(player.playlist).toEqual([]);
    expect(sources[0].fadeTo).toHaveBeenLastCalledWith(0, 400);
    await flush();
    expect(done).not.toHaveBeenCalled();
    sources[0].settleFade();
    await flush();
    expect(done).toHaveBeenCalled();
    expect(sources[0].dispose).toHaveBeenCalled();
    await player.next();
    expect(sources).toHaveLength(1);
  });

  it('releases an outgoing track even when its fade is taken over', async () => {
    const { scene, sources } = fakeAudioScene();
    const player = new MusicPlayer<Track>(scene);
    await player.play(track('a'));
    player.stop();
    sources[0].settleFade(false);
    await flush();
    expect(sources[0].dispose).toHaveBeenCalled();
  });

  describe('shuffle', () => {
    it('plays every track once per round, never the same track twice in a row', async () => {
      const { scene, sources } = fakeAudioScene();
      const player = new MusicPlayer<Track>(scene, { random: seededRandom(7) });
      const tracks = ['a', 'b', 'c', 'd'].map(t => track(t));
      await player.play(tracks, { shuffle: true });
      const played = [player.nowPlaying!.title];
      for (let i = 0; i < 39; i++) {
        sources[sources.length - 1].end();
        await flush();
        played.push(player.nowPlaying!.title);
      }
      for (let round = 0; round < 10; round++) {
        expect([...played.slice(round * 4, round * 4 + 4)].sort()).toEqual(['a', 'b', 'c', 'd']);
      }
      for (let i = 1; i < played.length; i++) {
        expect(played[i]).not.toBe(played[i - 1]);
      }
      expect(new Set(played.filter((_, i) => i % 4 === 0)).size).toBeGreaterThan(1); // not one fixed order
    });

    it('does not start a new playlist with the track playing now', async () => {
      const { scene } = fakeAudioScene();
      // always picks index 0: the shuffle leaves the first track first
      const player = new MusicPlayer<Track>(scene, { random: () => 0.999 });
      const tracks = [track('a'), track('b'), track('c')];
      await player.play(tracks, { shuffle: true });
      const first = player.nowPlaying;
      await player.play(tracks, { shuffle: true });
      expect(player.nowPlaying).not.toBe(first);
    });
  });

  describe('load failures', () => {
    it('skips a track that fails to load', async () => {
      const { scene, factory } = fakeAudioScene();
      factory.loadClip.mockImplementation((url: string) =>
        url === 'broken-1.ogg' ? Promise.reject(new Error('404')) : Promise.resolve({ url }),
      );
      const player = new MusicPlayer<Track>(scene);
      await player.play([track('broken-1'), track('fine')]);
      expect(player.nowPlaying!.title).toBe('fine');
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('broken-1.ogg'), expect.any(Error));
    });

    it('stops when no track of the playlist loads', async () => {
      const { scene, factory, sources } = fakeAudioScene();
      const player = new MusicPlayer<Track>(scene);
      await player.play(track('ok'));
      factory.loadClip.mockImplementation(() => Promise.reject(new Error('offline')));
      const playing = player.play([track('broken-2'), track('broken-3')]);
      await flush();
      sources[0].settleFade();
      await playing;
      expect(factory.loadClip).toHaveBeenCalledTimes(3);
      expect(player.nowPlaying).toBeNull();
      expect(sources[0].dispose).toHaveBeenCalled();
    });
  });

  it('loads through the loadClip option when given', async () => {
    const { scene, factory, sources } = fakeAudioScene();
    const loadClip = jest.fn((url: string) => Promise.resolve({ cached: url }));
    const player = new MusicPlayer<Track>(scene, { loadClip, bus: 'bgm', priority: 5 });
    await player.play(track('a'));
    expect(loadClip).toHaveBeenCalledWith('a.ogg');
    expect(factory.loadClip).not.toHaveBeenCalled();
    expect(sources[0].descriptor).toEqual(
      expect.objectContaining({ clip: { cached: 'a.ogg' }, bus: 'bgm', priority: 5 }),
    );
  });

  it('starts without a fade for a crossfade of 0', async () => {
    const { scene, sources } = fakeAudioScene();
    const player = new MusicPlayer<Track>(scene);
    await player.play(track('a'), { crossfadeMs: 0 });
    await player.play(track('b'), { crossfadeMs: 0 });
    expect(sources[0].fadeTo).not.toHaveBeenCalled();
    expect(sources[0].descriptor.volume).toBe(1);
    expect(sources[0].dispose).toHaveBeenCalled();
  });

  it('rejects a negative or non-finite crossfade', () => {
    const { scene } = fakeAudioScene();
    expect(() => new MusicPlayer(scene, { crossfadeMs: -1 })).toThrow(RangeError);
    const player = new MusicPlayer(scene);
    expect(() => player.play(track('a'), { crossfadeMs: NaN })).toThrow(RangeError);
    expect(() => player.stop(Infinity)).toThrow(RangeError);
  });

  it('dispose() stops every track at once and completes nowPlaying$', async () => {
    const { scene, sources } = fakeAudioScene();
    const player = new MusicPlayer<Track>(scene);
    await player.play(track('a'));
    await player.play(track('b'));
    const complete = jest.fn();
    player.nowPlaying$.subscribe({ complete });
    player.dispose();
    expect(sources.every(s => s.disposed)).toBe(true);
    expect(complete).toHaveBeenCalled();
  });
});
