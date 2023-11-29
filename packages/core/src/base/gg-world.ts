import {
  GgConsoleUI,
  GgDebuggerUI,
  IEntity,
  GgGlobalClock,
  GgStatic,
  TickOrder,
  IPhysicsWorldComponent,
  IVisualSceneComponent,
  KeyboardInput,
  PausableClock,
  IPositionable,
  IRenderableEntity,
} from '../base';
import { filter } from 'rxjs';

export abstract class GgWorld<
  D,
  R,
  V extends IVisualSceneComponent<D, R> = IVisualSceneComponent<D, R>,
  P extends IPhysicsWorldComponent<D, R> = IPhysicsWorldComponent<D, R>,
> {
  public readonly worldClock: PausableClock = GgGlobalClock.instance.createChildClock(false);
  public readonly keyboardInput: KeyboardInput = new KeyboardInput();

  readonly children: IEntity[] = [];
  // the same as children, but sorted by tick order
  protected readonly tickListeners: IEntity[] = [];

  constructor(
    public readonly visualScene: V,
    public readonly physicsWorld: P,
    protected readonly consoleEnabled: boolean = false,
  ) {
    GgStatic.instance.worlds.push(this);
    GgStatic.instance.selectedWorld = this;
    this.keyboardInput.start();
    if (consoleEnabled) {
      // TODO this listener should be outside of the world
      this.keyboardInput
        .bind('Backquote')
        .pipe(filter(x => x))
        .subscribe(() => {
          // open console UI
          if (GgConsoleUI.instance.isUIShown) {
            GgConsoleUI.instance.destroyUI();
          } else {
            GgConsoleUI.instance.createUI();
          }
        });
      this.registerConsoleCommand(
        'commandslist',
        async () => {
          return Object.entries(this.commands)
            .map(([key, value]) => `${key}${value.doc ? '\t// ' + value.doc : ''}`)
            .sort()
            .join('\n\n');
        },
        'no args; print all available commands',
      );
      this.registerConsoleCommand(
        'debugger',
        async (...args: string[]) => {
          const shouldDraw = ['1', 'true', '+'].includes(args[0]);
          if (shouldDraw != GgDebuggerUI.instance.isUIShown) {
            if (GgDebuggerUI.instance.isUIShown) {
              GgDebuggerUI.instance.destroyUI();
            } else {
              GgDebuggerUI.instance.createUI();
            }
          }
          return '' + GgDebuggerUI.instance.isUIShown;
        },
        'args: [0 or 1]; turn on/off debug panel. Default value is 0',
      );
      this.registerConsoleCommand(
        'ph_timescale',
        async (...args: string[]) => {
          this.physicsWorld.timeScale = +args[0];
          return JSON.stringify(this.physicsWorld.timeScale);
        },
        'args: [float]; change time scale of physics engine. Default value is 1.0',
      );
      this.registerConsoleCommand(
        'dr_drawphysics',
        async (...args: string[]) => {
          this.physicsDebugViewActive = ['1', 'true', '+'].includes(args[0]);
          return '' + this.physicsWorld.physicsDebugViewActive;
        },
        'args: [0 or 1]; turn on/off physics debug view. Default value is 0',
      );
    }
  }

  public async init() {
    await Promise.all([this.physicsWorld.init(), this.visualScene.init()]);
    this.worldClock.tick$.subscribe(([elapsed, delta]) => {
      let i = 0;
      // emit tick to all entities with tick order < GGTickOrder.PHYSICS_SIMULATION
      for (i; i < this.tickListeners.length; i++) {
        if (this.tickListeners[i].tickOrder >= TickOrder.PHYSICS_SIMULATION) {
          break;
        }
        if (this.tickListeners[i].active) {
          this.tickListeners[i].tick$.next([elapsed, delta]);
        }
      }
      // run phycics simulation
      this.physicsWorld.simulate(delta);
      // emit tick to all remained entities
      for (i; i < this.tickListeners.length; i++) {
        if (this.tickListeners[i].active) {
          this.tickListeners[i].tick$.next([elapsed, delta]);
        }
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
    this.worldClock.resume();
  }

  public get isRunning(): boolean {
    return this.worldClock.isRunning;
  }

  public get isPaused(): boolean {
    return this.worldClock.isPaused;
  }

  public get worldTime(): number {
    return this.worldClock.elapsedTime;
  }

  public createClock(autoStart: boolean): PausableClock {
    return this.worldClock.createChildClock(autoStart);
  }

  public dispose(): void {
    this.worldClock.stop();
    this.keyboardInput.stop();
    for (let i = 0; i < this.children.length; i++) {
      this.children[i].onRemoved();
      this.children[i].dispose();
    }
    this.children.splice(0, this.children.length);
    this.tickListeners.splice(0, this.tickListeners.length);
    this.physicsWorld.dispose();
    this.visualScene.dispose();
  }

  abstract addPrimitiveRigidBody(
    descr: any,
    position?: D,
    rotation?: R,
  ): IPositionable<D, R> & IRenderableEntity<D, R, V, P>;

  public addEntity(entity: IEntity): void {
    if (!!entity.world) {
      console.warn('Trying to spawn entity, which is already spawned');
      return;
    }
    this.children.push(entity);
    this.tickListeners.push(entity);
    this.tickListeners.sort((l1, l2) => l1.tickOrder - l2.tickOrder);
    entity.onSpawned(this);
  }

  public removeEntity(entity: IEntity, dispose = false): void {
    if (entity.world) {
      if (entity.world !== this) {
        throw new Error('Entity is not a part of this world');
      }
      this.children.splice(
        this.children.findIndex(x => x === entity),
        1,
      );
      this.tickListeners.splice(
        this.tickListeners.findIndex(x => (x as any) === entity),
        1,
      );
      entity.onRemoved();
    }
    if (dispose) {
      entity.dispose();
    }
  }

  protected commands: { [key: string]: { handler: (...args: string[]) => Promise<string>; doc?: string } } = {};

  public registerConsoleCommand(command: string, handler: (...args: string[]) => Promise<string>, doc?: string): void {
    if (!this.consoleEnabled) {
      throw new Error('Console not enabled for this world');
    }
    this.commands[command] = { handler, doc };
  }

  public async runConsoleCommand(command: string, args: string[]): Promise<string> {
    if (!this.consoleEnabled) {
      throw new Error('Console not enabled for this world');
    }
    if (!this.commands[command]) {
      return 'Unrecognized command: ' + command;
    }
    try {
      return await this.commands[command].handler(...args);
    } catch (err) {
      return `${err}`;
    }
  }

  public get physicsDebugViewActive(): boolean {
    return this.physicsWorld.physicsDebugViewActive;
  }

  public set physicsDebugViewActive(value: boolean) {
    if (this.physicsDebugViewActive === value) {
      return;
    }
    if (value) {
      const cls = this.visualScene.debugPhysicsDrawerClass;
      if (!cls) {
        throw new Error('Debug drawer is not available');
      }
      this.physicsWorld.startDebugger(this, new cls());
    } else {
      this.physicsWorld.stopDebugger(this);
    }
  }
}
