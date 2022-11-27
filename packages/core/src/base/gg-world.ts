import { Clock } from './clock';
import { GgEntity } from './entities/gg-entity';
import { isITickListener, ITickListener } from './entities/interfaces/i-tick-listener';
import { GgPhysicsWorld } from './interfaces/gg-physics-world';
import { GgVisualScene } from './interfaces/gg-visual-scene';
import { GgStatic } from './gg-static';

export abstract class GgWorld<D, R> {

  // inner clock, runs constantly
  private readonly animationFrameClock: Clock = Clock.animationFrameClock;
  // world clock, can be paused/resumed. Stops when disposing world
  private readonly worldClock: Clock = new Clock(this.animationFrameClock.tick$);

  readonly children: GgEntity[] = [];
  protected readonly tickListeners: ITickListener[] = [];

  constructor(
    public readonly visualScene: GgVisualScene<D, R>,
    public readonly physicsWorld: GgPhysicsWorld<D, R>,
    protected readonly consoleEnabled: boolean = false,
  ) {
    GgStatic.instance.worlds.push(this);
    GgStatic.instance.selectedWorld = this;
  }

  public async init(
  ) {
    await Promise.all([
      this.physicsWorld.init(),
      this.visualScene.init(),
    ]);
    this.worldClock.tick$.subscribe(([elapsed, delta]) => {
      let physicsTickPerformed = false;
      for (let i = 0; i < this.tickListeners.length; i++) {
        if (!physicsTickPerformed && this.tickListeners[i].tickOrder >= 500) {
          this.physicsWorld.simulate(delta);
          physicsTickPerformed = true;
        }
        this.tickListeners[i].tick$.next([elapsed, delta]);
      }
      if (!physicsTickPerformed) {
        this.physicsWorld.simulate(delta);
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

  public addEntity(entity: GgEntity): void {
    if (!!entity.world) {
      throw new Error('Entity already spawned');
    }
    this.children.push(entity);
    if (isITickListener(entity)) {
      this.tickListeners.push(entity as any as ITickListener);
      this.tickListeners.sort((l1, l2) => l1.tickOrder - l2.tickOrder);
    }
    entity.onSpawned(this);
  }

  public removeEntity(entity: GgEntity, dispose = true): void {
    if (entity.world !== this) {
      throw new Error('Entity is not a part of this world');
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

  protected commands: { [key: string]: (...args: string[]) => string } = {};

  public registerConsoleCommand(command: string, handler: (...args: string[]) => string): void {
    if (!this.consoleEnabled) {
      throw new Error('Console not enabled for this world');
    }
    this.commands[command] = handler;
  }

  public runConsoleCommand(command: string, args: string[]): string {
    if (!this.consoleEnabled) {
      throw new Error('Console not enabled for this world');
    }
    if (!this.commands[command]) {
      return 'Unrecognized command: ' + command;
    }
    return this.commands[command](...args);
  }

}
