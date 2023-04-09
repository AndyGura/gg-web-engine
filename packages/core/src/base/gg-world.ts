import { PausableClock } from './clock/pausable-clock';
import { GgEntity, GGTickOrder } from './entities/gg-entity';
import { GgPhysicsWorld } from './interfaces/gg-physics-world';
import { GgVisualScene } from './interfaces/gg-visual-scene';
import { GgStatic } from './gg-static';
import { KeyboardInput } from './inputs/keyboard.input';
import { filter } from 'rxjs';
import { GgConsoleUI } from './ui/gg-console.ui';
import { GgDebuggerUI } from './ui/gg-debugger.ui';
import { GgGlobalClock } from './clock/global-clock';
import { GgPositionableEntity } from './entities/gg-positionable-entity';

export abstract class GgWorld<
  D,
  R,
  V extends GgVisualScene<D, R> = GgVisualScene<D, R>,
  P extends GgPhysicsWorld<D, R> = GgPhysicsWorld<D, R>,
> {
  public readonly worldClock: PausableClock = GgGlobalClock.instance.createChildClock(false);
  public readonly keyboardInput: KeyboardInput = new KeyboardInput();

  readonly children: GgEntity[] = [];
  // the same as children, but sorted by tick order
  protected readonly tickListeners: GgEntity[] = [];

  constructor(
    public readonly visualScene: V,
    public readonly physicsWorld: P,
    protected readonly consoleEnabled: boolean = false,
  ) {
    GgStatic.instance.worlds.push(this);
    GgStatic.instance.selectedWorld = this;
    this.keyboardInput.start().then();
    if (consoleEnabled) {
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
          const shouldDraw = ['1', 'true', '+'].includes(args[0]);
          if (shouldDraw != this.physicsWorld.physicsDebugViewActive) {
            this.triggerPhysicsDebugView();
          }
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
        if (this.tickListeners[i].tickOrder >= GGTickOrder.PHYSICS_SIMULATION) {
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
    for (let i = 0; i < this.children.length; i++) {
      this.children[i].onRemoved();
      this.children[i].dispose();
    }
    this.children.splice(0, this.children.length);
    this.tickListeners.splice(0, this.tickListeners.length);
    this.physicsWorld.dispose();
    this.visualScene.dispose();
  }

  abstract addPrimitiveRigidBody(descr: any, position?: D, rotation?: R): GgPositionableEntity<D, R>;

  public addEntity(entity: GgEntity): void {
    if (!!entity.world) {
      console.warn('Trying to spawn entity, which is already spawned');
      return;
    }
    this.children.push(entity);
    this.tickListeners.push(entity);
    this.tickListeners.sort((l1, l2) => l1.tickOrder - l2.tickOrder);
    entity.onSpawned(this);
  }

  public removeEntity(entity: GgEntity, dispose = true): void {
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
    } else {
      console.warn('Trying to remove entity, which is not spawned');
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
    return this.commands[command].handler(...args);
  }

  public triggerPhysicsDebugView() {
    if (this.physicsWorld.physicsDebugViewActive) {
      this.physicsWorld.stopDebugger(this);
    } else {
      const cls = this.visualScene.debugPhysicsDrawerClass;
      if (!cls) {
        throw new Error('Debug drawer is not available');
      }
      this.physicsWorld.startDebugger(this, new cls());
    }
  }
}
