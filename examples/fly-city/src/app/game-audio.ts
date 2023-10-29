import { RaycastVehicle3dEntity, } from '@gg-web-engine/core';
import { distinctUntilChanged, NEVER, Observable, of, skip, switchMap } from 'rxjs';
import { map } from 'rxjs/operators';
import { Howl } from 'howler';
import { HttpClient } from '@angular/common/http';

export type CurrentState =
  { mode: 'freecamera' }
  | { mode: 'driving', car: RaycastVehicle3dEntity, carType: 'lambo' | 'truck' | 'car' };

export class GameAudio {

  private engineOnHowl!: Howl;
  private engineOffHowl!: Howl;
  private changeGearHowl!: Howl;
  private honkHowl!: Howl;

  constructor(
    public readonly http: HttpClient,
    public readonly state$: Observable<CurrentState>,
  ) {
  }

  public set honk(honk: boolean) {
    if (honk && !this.honkHowl.playing()) {
      this.honkHowl.play();
    }
    if (!honk && this.honkHowl.playing()) {
      this.honkHowl.stop();
    }
  }

  public async initAudio() {
    const engineOnMeta: any = await this.http.get(`assets/engine_on.meta.json`).toPromise();
    this.engineOnHowl = new Howl({
      src: `assets/engine_on.mp3`,
      loop: true,
      sprite: engineOnMeta.loop_end_time_ms ? {
        __default: [0, engineOnMeta.loop_end_time_ms, false],
        loop: [engineOnMeta.loop_start_time_ms, engineOnMeta.loop_end_time_ms, true]
      } : undefined,
    });

    const engineOffMeta: any = await this.http.get(`assets/engine_off.meta.json`).toPromise();
    this.engineOffHowl = new Howl({
      src: `assets/engine_off.mp3`,
      loop: true,
      sprite: engineOffMeta.loop_end_time_ms ? {
        __default: [0, engineOffMeta.loop_end_time_ms, false],
        loop: [engineOffMeta.loop_start_time_ms, engineOffMeta.loop_end_time_ms, true]
      } : undefined,
    });
    this.changeGearHowl = new Howl({ src: `assets/gear.mp3` });
    this.honkHowl = new Howl({
      src: `assets/honk_loop.mp3`,
      loop: true,
    });

    this.state$.pipe(
      switchMap(state => state.mode === 'freecamera' ? NEVER : state.car.gear$.pipe(skip(1))),
    ).subscribe(() => {
      if (this.changeGearHowl.playing()) {
        this.changeGearHowl.stop();
      }
      this.changeGearHowl.play();
    });

    this.engineOnHowl.rate(0);
    this.engineOffHowl.rate(0);
    this.engineOnHowl.volume(0);
    this.engineOffHowl.volume(0);
    this.engineOnHowl.play();
    this.engineOffHowl.play();

    this.state$.pipe(
      switchMap(state => state.mode === 'freecamera' ? of(null) : state.car.acceleration$),
      map((acc: number | null) => acc === null ? null : (acc > 0 ? this.engineOnHowl : this.engineOffHowl)),
      distinctUntilChanged(),
    ).subscribe((activeHowl: any) => {
      if (activeHowl) {
        activeHowl.fade(activeHowl.volume(), 0.25, 100);
        const inactiveHowl = (activeHowl == this.engineOffHowl ? this.engineOnHowl : this.engineOffHowl);
        if (inactiveHowl && inactiveHowl.volume() > 0) {
          inactiveHowl.fade(inactiveHowl.volume(), 0, 100);
        }
      } else {
        this.engineOnHowl.fade(this.engineOnHowl.volume(), 0, 100);
        this.engineOffHowl.fade(this.engineOffHowl.volume(), 0, 100);
      }
    });

    this.state$.pipe(
      switchMap(state => state.mode === 'freecamera' ? NEVER : state.car.engineRpm$.pipe(map(rpm => [state.car, rpm] as [RaycastVehicle3dEntity, number]))),
    ).subscribe(([car, rpm]: [RaycastVehicle3dEntity, number]) => {
      const engineRpmFactor = ((rpm - 800) / car.carProperties.engine.maxRpm) - 0.5;
      this.engineOnHowl.rate(1 + engineRpmFactor);
      this.engineOffHowl.rate(1 + engineRpmFactor);
    });
  }

  disposeAudio() {
    this.engineOnHowl.stop();
    this.engineOffHowl.stop();
    this.changeGearHowl.stop();
    this.honkHowl.stop();
    this.engineOnHowl.unload();
    this.engineOffHowl.unload();
    this.changeGearHowl.unload();
    this.honkHowl.unload();
    this.engineOnHowl = null!;
    this.engineOffHowl = null!;
    this.changeGearHowl = null!;
    this.honkHowl = null!;
  }

}
