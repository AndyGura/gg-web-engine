import { Clock } from './clock';
import { GgEntity } from './entities/gg-entity';
import { isITickListener, ITickListener } from './entities/interfaces/i-tick-listener';
import { SpawnOptions } from './models/spawn-options';
import { GgPhysicsWorld } from './interfaces/gg-physics-world';
import { GgVisualScene } from './interfaces/gg-visual-scene';

export class GgWorld<D, R> {

  // inner clock, runs constantly
  private readonly animationFrameClock: Clock = Clock.animationFrameClock;
  // world clock, can be paused/resumed. Stops when disposing world
  private readonly worldClock: Clock = new Clock(this.animationFrameClock.clockTick$);

  readonly children: GgEntity[] = [];
  readonly tickListeners: ITickListener[] = [];

  constructor(
    public readonly visualScene: GgVisualScene<D, R>,
    public readonly physicsWorld: GgPhysicsWorld<D, R>,
  ) {
  }

  public async init(
  ) {
    this.physicsWorld.init();
    this.visualScene.init();
    this.worldClock.deltaTick$.subscribe((delta) => {
      this.physicsWorld.simulate(delta);
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
    this.physicsWorld.dispose();
    this.visualScene.dispose();
  }

  public addEntity(entity: GgEntity, options: Partial<SpawnOptions<D, R>> = {}): void {
    if (!!entity.world) {
      throw new Error('Entity already spawned');
    }
    this.children.push(entity);
    if (isITickListener(entity)) {
      this.tickListeners.push(entity as any as ITickListener);
    }
    entity.onSpawned(this);
  }

  public removeEntity(entity: GgEntity, dispose = true): void {
    if (entity.world !== this) {
      throw new Error('Entity not present in world');
    }
    this.children.splice(this.children.findIndex(x => x === entity), 1);
    if (isITickListener(entity)) {
      this.tickListeners.splice(this.tickListeners.findIndex(x => x as any === entity), 1);
    }
    entity.onRemoved();
    if (dispose) {
      entity.dispose();
    }
  }

}
