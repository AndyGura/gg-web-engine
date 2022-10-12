import { Clock } from './clock';
import { GgEntity } from '../entities/gg-entity';
import { SpawnOptions } from '../models/spawn-options';
import { isITickListener, ITickListener } from '../entities/interfaces/i-tick-listener';

export class GgWorld {

  // inner clock, runs constantly
  private readonly animationFrameClock: Clock = Clock.animationFrameClock;
  // world clock, can be paused/resumed. Stops when disposing world
  private readonly worldClock: Clock = new Clock(this.animationFrameClock.clockTick$);

  readonly children: GgEntity[] = [];
  readonly tickListeners: ITickListener[] = [];

  public async init() {
    // TODO
    this.worldClock.deltaTick$.subscribe((delta) => {
      for (let i = 0; i < this.tickListeners.length; i++) {
        this.tickListeners[i].tick$.next(delta);
      }
    });
  }

  public start() {
    this.worldClock.start();
  }

  public pauseWorld() {
    this.worldClock.pause();
  }

  public resumeWorld() {
    this.worldClock.pause();
  }

  public dispose(): void {
    this.worldClock.stop();
    // TODO
  }

  public addEntity(entity: GgEntity, options: Partial<SpawnOptions> = {}): void {
    // TODO
    this.children.push(entity);
    if (isITickListener(entity)) {
      this.tickListeners.push(entity as ITickListener);
    }
  }

  public removeEntity(entity: GgEntity, dispose = true): void {
    const index = this.children.findIndex(x => x === entity);
    if (index > -1) {
      // TODO
      this.children.splice(index, 1);
      if (isITickListener(entity)) {
        this.tickListeners.splice(this.tickListeners.findIndex(x => x === entity), 1);
      }
    }
  }

}
