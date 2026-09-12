import { AudioSourceDescriptor, GgCarEntity } from '@gg-web-engine/core';
import { WebAudioSource3dComponent, WebAudioTypeDocRepo3D } from '@gg-web-engine/audio';
import { distinctUntilChanged, NEVER, Observable, of, skip, switchMap } from 'rxjs';
import { map } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';
import { FlyCityWorld } from './app.component';

export type CurrentState =
  { mode: 'freecamera' }
  | { mode: 'driving', car: GgCarEntity, carType: 'lambo' | 'truck' | 'car' };

const ASSETS_BASE = 'https://gg-web-demos.guraklgames.com/assets/fly-city';

type LoopMeta = { loop_start_time_ms?: number; loop_end_time_ms?: number };

/**
 * Non-positional (`spatial: false`) engine/gear/honk audio for whichever car the player is
 * currently driving - see `game-audio.ts`'s own git history (pre-migration) for the Howler.js
 * version this replaces, and the audio subsystem design doc's "Case study: engine sound" section
 * for why this stays non-spatial even though the source is technically attached to a moving car:
 * the chase camera moves with the car, so its distance to the listener never meaningfully changes,
 * and spatializing it would only reintroduce the near-field jitter that doc diagnoses.
 */
export class GameAudio {

  private engineOnSource!: WebAudioSource3dComponent;
  private engineOffSource!: WebAudioSource3dComponent;
  private changeGearSource!: WebAudioSource3dComponent;
  private honkSource!: WebAudioSource3dComponent;

  constructor(
    public readonly http: HttpClient,
    public readonly world: FlyCityWorld,
    public readonly state$: Observable<CurrentState>,
  ) {
  }

  public set honk(honk: boolean) {
    if (honk && !this.honkSource.isPlaying) {
      this.honkSource.play();
    }
    if (!honk && this.honkSource.isPlaying) {
      this.honkSource.stop();
    }
  }

  /** Fetches `<name>.meta.json` and converts its millisecond loop points to the seconds our `AudioSourceDescriptor.loopStart`/`loopEnd` expect - `undefined` (no partial loop region) if the clip has none. */
  private async loadLoopRegion(name: string): Promise<Pick<AudioSourceDescriptor, 'loopStart' | 'loopEnd'>> {
    const meta = await this.http.get<LoopMeta>(`${ASSETS_BASE}/${name}.meta.json`).toPromise();
    if (!meta?.loop_end_time_ms) {
      return {};
    }
    return { loopStart: (meta.loop_start_time_ms ?? 0) / 1000, loopEnd: meta.loop_end_time_ms / 1000 };
  }

  public async initAudio() {
    const factory = this.world.audioScene!.factory;

    const [engineOnClip, engineOnLoop] = await Promise.all([
      factory.loadClip(`${ASSETS_BASE}/engine_on.mp3`),
      this.loadLoopRegion('engine_on'),
    ]);
    this.engineOnSource = factory.createSource({
      clip: engineOnClip, loop: true, ...engineOnLoop, spatial: false, volume: 0, playbackRate: 0,
    });

    const [engineOffClip, engineOffLoop] = await Promise.all([
      factory.loadClip(`${ASSETS_BASE}/engine_off.mp3`),
      this.loadLoopRegion('engine_off'),
    ]);
    this.engineOffSource = factory.createSource({
      clip: engineOffClip, loop: true, ...engineOffLoop, spatial: false, volume: 0, playbackRate: 0,
    });

    this.changeGearSource = factory.createSource({
      clip: await factory.loadClip(`${ASSETS_BASE}/gear.mp3`), loop: false, spatial: false, autoplay: false,
    });
    this.honkSource = factory.createSource({
      clip: await factory.loadClip(`${ASSETS_BASE}/honk_loop.mp3`), loop: true, spatial: false, autoplay: false,
    });

    this.state$.pipe(
      switchMap(state => state.mode === 'freecamera' ? NEVER : state.car.gear$.pipe(skip(1))),
    ).subscribe(() => {
      // restart from the beginning on every gear change, even if the previous shift's sound is
      // still playing - play() is a no-op while already playing, so an explicit stop() first
      // mirrors what the original Howler `.play()` (which always restarts) did here
      if (this.changeGearSource.isPlaying) {
        this.changeGearSource.stop();
      }
      this.changeGearSource.play();
    });

    this.state$.pipe(
      switchMap(state => state.mode === 'freecamera' ? of(null) : state.car.acceleration$),
      map((acc: number | null) => acc === null ? null : (acc > 0 ? this.engineOnSource : this.engineOffSource)),
      distinctUntilChanged(),
    ).subscribe((activeSource) => {
      if (activeSource) {
        activeSource.volume = 0.25;
        const inactiveSource = activeSource === this.engineOffSource ? this.engineOnSource : this.engineOffSource;
        if (inactiveSource.volume > 0) {
          inactiveSource.volume = 0;
        }
      } else {
        this.engineOnSource.volume = 0;
        this.engineOffSource.volume = 0;
      }
    });

    this.state$.pipe(
      switchMap(state => state.mode === 'freecamera' ? NEVER : state.car.engineRpm$.pipe(map(rpm => [state.car, rpm] as [GgCarEntity, number]))),
    ).subscribe(([car, rpm]: [GgCarEntity, number]) => {
      const engineRpmFactor = ((rpm - 800) / car.carProperties.engine.maxRpm) - 0.5;
      this.engineOnSource.playbackRate = 1 + engineRpmFactor;
      this.engineOffSource.playbackRate = 1 + engineRpmFactor;
    });
  }

  disposeAudio() {
    this.engineOnSource.dispose();
    this.engineOffSource.dispose();
    this.changeGearSource.dispose();
    this.honkSource.dispose();
    this.engineOnSource = null!;
    this.engineOffSource = null!;
    this.changeGearSource = null!;
    this.honkSource = null!;
  }

}
