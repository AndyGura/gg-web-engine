import { Clock } from './clock';
import { GgEntity } from './entities/gg-entity';
import { isITickListener, ITickListener } from './entities/interfaces/i-tick-listener';
import { SpawnOptions } from './models/spawn-options';

export class GgWorld<D, R> {

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
    for (let i = 0; i < this.children.length; i++) {
      this.children[i].dispose();
    }
    this.children.splice(0, this.children.length);
    this.tickListeners.splice(0, this.tickListeners.length);
  }

  public addEntity(entity: GgEntity, options: Partial<SpawnOptions<D, R>> = {}): void {
    // TODO
    this.children.push(entity);
    if (isITickListener(entity)) {
      this.tickListeners.push(entity as any as ITickListener);
    }
  }

  public removeEntity(entity: GgEntity, dispose = true): void {
    const index = this.children.findIndex(x => x === entity);
    if (index > -1) {
      // TODO
      this.children.splice(index, 1);
      if (isITickListener(entity)) {
        this.tickListeners.splice(this.tickListeners.findIndex(x => x as any === entity), 1);
      }
    }
  }

}
