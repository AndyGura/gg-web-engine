import { Clock } from './clock';
import { GgEntity } from './entities/gg-entity';
import { isITickListener, ITickListener } from './entities/interfaces/i-tick-listener';
import { GgPhysicsWorld } from './interfaces/gg-physics-world';
import { GgVisualScene } from './interfaces/gg-visual-scene';
import { GgStatic } from './gg-static';
import { KeyboardController } from './controllers/base/keyboard.controller';

export abstract class GgWorld<D, R> {

  // inner clock, runs constantly
  private readonly animationFrameClock: Clock = Clock.animationFrameClock;
  // world clock, can be paused/resumed. Stops when disposing world
  private readonly worldClock: Clock = new Clock(this.animationFrameClock.tick$);

  // TODO consider adding mouse controller
  public readonly keyboardController: KeyboardController = new KeyboardController();

  readonly children: GgEntity[] = [];
  protected readonly tickListeners: ITickListener[] = [];

  constructor(
    public readonly visualScene: GgVisualScene<D, R>,
    public readonly physicsWorld: GgPhysicsWorld<D, R>,
    protected readonly consoleEnabled: boolean = false,
  ) {
    GgStatic.instance.worlds.push(this);
    GgStatic.instance.selectedWorld = this;
    this.keyboardController.start().then();
    if (consoleEnabled) {
      this.registerConsoleCommand('ph_timescale', async (...args: string[]) => {
        this.physicsWorld.timeScale = +args[0];
        return JSON.stringify(this.physicsWorld.timeScale);
      });
      this.registerConsoleCommand('dr_drawphysics', async (...args: string[]) => {
        const shouldDraw = ['1', 'true', '+'].includes(args[0]);
        if (shouldDraw != this.physicsWorld.debuggerActive) {
          if (shouldDraw) {
            // TODO move to function so can be called in the code
            const cls = this.visualScene.debugPhysicsDrawerClass;
            if (!cls) {
              throw new Error('Debug drawer is not available');
            }
            this.physicsWorld.startDebugger(this, new cls());
          } else {
            this.physicsWorld.stopDebugger(this);
          }
        }
        return '' + this.physicsWorld.debuggerActive;
      });
    }
  }

  public async init() {
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

  protected commands: { [key: string]: (...args: string[]) => Promise<string> } = {};

  public registerConsoleCommand(command: string, handler: (...args: string[]) => Promise<string>): void {
    if (!this.consoleEnabled) {
      throw new Error('Console not enabled for this world');
    }
    this.commands[command] = handler;
  }

  public async runConsoleCommand(command: string, args: string[]): Promise<string> {
    if (!this.consoleEnabled) {
      throw new Error('Console not enabled for this world');
    }
    if (!this.commands[command]) {
      return 'Unrecognized command: ' + command;
    }
    return this.commands[command](...args);
  }

}
