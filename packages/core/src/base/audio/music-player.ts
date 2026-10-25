import { BehaviorSubject, Observable, Subscription } from 'rxjs';
import { IAudioSceneComponent } from '../components/audio/i-audio-scene.component';
import { IAudioSourceComponent } from '../components/audio/i-audio-source.component';
import { warnOnce } from '../logging';

/**
 * One piece of music for {@link MusicPlayer}. An app can extend it with fields of its own (a
 * title, an artist) - `nowPlaying$` hands the same object back, so a "now playing" display reads
 * them from there.
 */
export interface MusicTrack {
  /** URL of the clip, loaded with the player's `loadClip` (the scene factory's, cached by URL, by default). */
  url: string;
  /** Volume the track plays at, 0-1, on top of the player's bus volume. Defaults to `1`. */
  volume?: number;
  /**
   * Loop this track instead of moving on to the next one at its end (`next()` still moves on).
   * Defaults to `false`.
   */
  loop?: boolean;
  /** Loop region in seconds, for a track with a lead-in - see `AudioSourceDescriptor.loopStart`/`loopEnd`. */
  loopStart?: number;
  loopEnd?: number;
}

/** How {@link MusicPlayer.play} plays a playlist. */
export interface MusicPlayOptions {
  /**
   * Crossfade from what is playing to the first track, and the default for `next()`/`stop()`
   * while this playlist plays, in milliseconds. A track that follows another at its natural end
   * starts at full volume, without a fade. Defaults to the player's `crossfadeMs`.
   */
  crossfadeMs?: number;
  /**
   * Plays the tracks in a random order: each once, then a new order, never starting with the track
   * that just played. Defaults to `false` (the order given).
   */
  shuffle?: boolean;
  /** Starts over (in a new random order, with `shuffle`) after the last track. Defaults to `true`. */
  repeat?: boolean;
}

/** Settings of a {@link MusicPlayer}, fixed at construction. */
export interface MusicPlayerOptions {
  /** Bus every track plays on - its volume is the music volume setting. Defaults to `"music"`. */
  bus?: string;
  /**
   * Voice priority of the tracks (`AudioSourceDescriptor.priority`). Defaults to `Infinity`: under
   * a voice budget, music is never the sound made virtual.
   */
  priority?: number;
  /** Default crossfade, in milliseconds, for a `play()` that sets none. Defaults to `1000`. */
  crossfadeMs?: number;
  /**
   * Loads a track's clip. Defaults to the scene factory's `loadClip`. A game with a world can pass
   * `url => world.loader.loadClip(url)` to load through the world's asset cache instead.
   */
  loadClip?: (url: string) => Promise<unknown>;
  /** Random number source in `[0, 1)` for `shuffle`. Defaults to `Math.random`. */
  random?: () => number;
}

type PlayingTrack<T> = {
  track: T;
  source: IAudioSourceComponent<any, any, any>;
  ended: Subscription;
};

/**
 * Plays music on one audio scene: a playlist of tracks, one after the other, crossfading whenever
 * the music changes (`play`, `next`, `stop`), optionally shuffled. Written against the audio scene
 * contract only, so it works with any audio adapter, and needs no world - it plays as well on a
 * scene of its own for the menus (call that scene's `init()`) as on `world.audioScene` (where it
 * pauses with the world).
 *
 * Tracks are non-positional sources on the player's bus (`"music"`), so the music volume setting is
 * `scene.setBusVolume('music', v)`. Each track's clip is loaded whole (decoded into memory) before
 * it starts; the track playing meanwhile keeps playing until then, so a crossfade is never a gap.
 *
 * Commands never wait for a fade: a fade runs on the audio clock (`IAudioSourceComponent.fadeTo`),
 * which stands still while the browser hasn't allowed audio to start yet (no user gesture so far)
 * or the world is paused. Music started then begins once audio is allowed, and later commands
 * replace it as usual. A track that fails to load is skipped (with a warning); a playlist none of
 * whose tracks load stops.
 *
 * @template T - The track type, {@link MusicTrack} or an app's extension of it
 */
export class MusicPlayer<T extends MusicTrack = MusicTrack> {
  private readonly bus: string;
  private readonly priority: number;
  private readonly defaultCrossfadeMs: number;
  private readonly load: (url: string) => Promise<unknown>;
  private readonly random: () => number;

  private tracks: readonly T[] = [];
  private crossfadeMs: number;
  private shuffle = false;
  private repeat = true;
  /** The tracks of the current round, in the order they play; `position` indexes it. */
  private order: T[] = [];
  private position = 0;
  private lastStarted: T | null = null;
  /** Tracks in a row that failed to load - a whole playlist of them stops the player. */
  private failures = 0;
  /** Bumped by every command, so a load still running for a replaced one is dropped. */
  private generation = 0;
  private disposed = false;

  private current: PlayingTrack<T> | null = null;
  /** Sources fading out, stopped and disposed once their fade ends. */
  private readonly outgoing = new Set<IAudioSourceComponent<any, any, any>>();
  private readonly nowPlayingSubject = new BehaviorSubject<T | null>(null);

  /**
   * @param scene - the audio scene the music plays on
   * @param options - see {@link MusicPlayerOptions}
   */
  constructor(
    private readonly scene: IAudioSceneComponent<any, any, any>,
    options: MusicPlayerOptions = {},
  ) {
    this.bus = options.bus ?? 'music';
    this.priority = options.priority ?? Infinity;
    this.defaultCrossfadeMs = checkFadeMs(options.crossfadeMs ?? 1000);
    this.crossfadeMs = this.defaultCrossfadeMs;
    this.load = options.loadClip ?? (url => this.scene.factory.loadClip(url));
    this.random = options.random ?? Math.random;
  }

  /** The track playing now (the one faded in last), `null` when the player is silent. */
  public get nowPlaying(): T | null {
    return this.nowPlayingSubject.value;
  }

  /**
   * Emits the track that starts playing (once its clip has loaded, as its fade-in begins), and
   * `null` when the music stops - for a "now playing" display. Emits the current value on
   * subscription.
   */
  public get nowPlaying$(): Observable<T | null> {
    return this.nowPlayingSubject.asObservable();
  }

  /** The playlist given to the last `play()`, in its own order; empty after `stop()`. */
  public get playlist(): readonly T[] {
    return this.tracks;
  }

  /**
   * Replaces the music with `tracks` (one track or a playlist): loads the first one, then crossfades
   * from whatever is playing into it. Calling it again with the track that is already playing
   * starts that track over.
   * @param tracks - what to play; an empty list is `stop()`
   * @param options - see {@link MusicPlayOptions}
   * @returns resolves once the first track has started, or once another command replaced this one
   * @throws RangeError when `crossfadeMs` is negative or not a finite number
   */
  public play(tracks: T | readonly T[], options: MusicPlayOptions = {}): Promise<void> {
    const crossfadeMs = checkFadeMs(options.crossfadeMs ?? this.defaultCrossfadeMs);
    const list: T[] = Array.isArray(tracks) ? [...tracks] : [tracks as T];
    if (list.length === 0) {
      return this.stop(crossfadeMs);
    }
    this.tracks = list;
    this.crossfadeMs = crossfadeMs;
    this.shuffle = options.shuffle ?? false;
    this.repeat = options.repeat ?? true;
    this.failures = 0;
    this.order = this.newRound();
    this.position = 0;
    return this.start(crossfadeMs);
  }

  /**
   * Crossfades to the next track of the playlist (after the last one: the first of a new round, or
   * silence without `repeat`). Does nothing while no playlist is set.
   * @param crossfadeMs - defaults to the playlist's crossfade
   * @returns resolves once the next track has started, or once another command replaced this one
   */
  public next(crossfadeMs: number = this.crossfadeMs): Promise<void> {
    checkFadeMs(crossfadeMs);
    if (this.tracks.length === 0) {
      return Promise.resolve();
    }
    if (!this.advance()) {
      return this.stop(crossfadeMs);
    }
    return this.start(crossfadeMs);
  }

  /**
   * Fades the music out and forgets the playlist; `nowPlaying$` emits `null` at once.
   * @param fadeMs - defaults to the playlist's crossfade
   * @returns resolves once the music has faded out
   */
  public stop(fadeMs: number = this.crossfadeMs): Promise<void> {
    checkFadeMs(fadeMs);
    this.generation++;
    this.tracks = [];
    this.order = [];
    this.position = 0;
    const faded = this.fadeOutCurrent(fadeMs);
    this.nowPlayingSubject.next(null);
    return faded;
  }

  /** Stops every track at once, without a fade, and completes `nowPlaying$`. */
  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.generation++;
    this.fadeOutCurrent(0);
    for (const source of [...this.outgoing]) {
      this.release(source);
    }
    this.outgoing.clear();
    this.nowPlayingSubject.next(null);
    this.nowPlayingSubject.complete();
  }

  /** The tracks of a new round: the playlist in order, or shuffled without repeating the last track first. */
  private newRound(): T[] {
    const order = [...this.tracks];
    if (this.shuffle) {
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(this.random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
      if (order.length > 1 && order[0] === this.lastStarted) {
        order.push(order.shift()!);
      }
    }
    return order;
  }

  /** Moves `position` to the next track, into a new round when needed; `false` at the end of a non-repeating playlist. */
  private advance(): boolean {
    this.position++;
    if (this.position >= this.order.length) {
      if (!this.repeat) {
        return false;
      }
      this.order = this.newRound();
      this.position = 0;
    }
    return true;
  }

  /** Loads the track at `position` and switches to it, unless another command came first. */
  private async start(fadeMs: number): Promise<void> {
    const generation = ++this.generation;
    const track = this.order[this.position];
    let clip: unknown;
    try {
      clip = await this.load(track.url);
    } catch (e) {
      if (generation !== this.generation) {
        return;
      }
      warnOnce(`MusicPlayer could not load "${track.url}" - skipping it`, e);
      this.failures++;
      if (this.failures >= this.tracks.length || !this.advance()) {
        await this.stop(fadeMs);
        return;
      }
      return this.start(fadeMs);
    }
    if (generation !== this.generation) {
      return;
    }
    this.failures = 0;
    this.switchTo(track, clip, fadeMs);
  }

  private switchTo(track: T, clip: unknown, fadeMs: number): void {
    const volume = track.volume ?? 1;
    const source = this.scene.factory.createSource({
      clip,
      bus: this.bus,
      spatial: false,
      autoplay: false,
      priority: this.priority,
      loop: track.loop ?? false,
      loopStart: track.loopStart,
      loopEnd: track.loopEnd,
      volume: fadeMs > 0 ? 0 : volume,
    }) as IAudioSourceComponent<any, any, any>;
    this.fadeOutCurrent(fadeMs);
    this.current = { track, source, ended: source.ended$.subscribe(() => this.onEnded(source)) };
    this.lastStarted = track;
    source.play();
    if (fadeMs > 0) {
      source.fadeTo(volume, fadeMs);
    }
    this.nowPlayingSubject.next(track);
  }

  /** A track reached its end on its own: the next one starts right away, at full volume. */
  private onEnded(source: IAudioSourceComponent<any, any, any>): void {
    if (this.current?.source !== source) {
      return;
    }
    this.current.ended.unsubscribe();
    this.current = null;
    this.release(source);
    if (this.advance()) {
      this.start(0).catch(e => warnOnce('MusicPlayer could not start the next track:', e));
    } else {
      this.generation++;
      this.tracks = [];
      this.nowPlayingSubject.next(null);
    }
  }

  /** Fades the current track out (`fadeMs` 0: stops it at once); resolves when it is gone. */
  private fadeOutCurrent(fadeMs: number): Promise<void> {
    const current = this.current;
    if (!current) {
      return Promise.resolve();
    }
    this.current = null;
    current.ended.unsubscribe();
    const source = current.source;
    if (fadeMs <= 0 || !source.isPlaying) {
      this.release(source);
      return Promise.resolve();
    }
    this.outgoing.add(source);
    return source.fadeTo(0, fadeMs).then(() => {
      if (this.outgoing.delete(source)) {
        this.release(source);
      }
    });
  }

  private release(source: IAudioSourceComponent<any, any, any>): void {
    source.stop();
    source.dispose();
  }
}

function checkFadeMs(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`MusicPlayer fade time must be a non-negative number of milliseconds, got ${value}`);
  }
  return value;
}
