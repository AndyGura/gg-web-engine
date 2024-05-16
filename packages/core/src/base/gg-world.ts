import {
  GgGlobalClock,
  IDisplayObjectComponent,
  IEntity,
  IPhysicsWorldComponent,
  IPositionable,
  IRenderableEntity,
  IRendererComponent,
  IRendererEntity,
  IRigidBodyComponent,
  ITriggerComponent,
  IVisualSceneComponent,
  KeyboardInput,
  PausableClock,
  TickOrder,
} from '../base';
import { Subject, take, lastValueFrom } from 'rxjs';
import { PerformanceMeterEntity } from '../dev';

export type VisualTypeDocRepo<D, R> = {
  factory: unknown;
  displayObject: IDisplayObjectComponent<D, R>;
  renderer: IRendererComponent<D, R>;
};

export type PhysicsTypeDocRepo<D, R> = {
  factory: unknown;
  rigidBody: IRigidBodyComponent<D, R>;
  trigger: ITriggerComponent<D, R>;
};

export abstract class GgWorld<
  D,
  R,
  VTypeDoc extends VisualTypeDocRepo<D, R> = VisualTypeDocRepo<D, R>,
  PTypeDoc extends PhysicsTypeDocRepo<D, R> = PhysicsTypeDocRepo<D, R>,
  VS extends IVisualSceneComponent<D, R, VTypeDoc> = IVisualSceneComponent<D, R, VTypeDoc>,
  PW extends IPhysicsWorldComponent<D, R, PTypeDoc> = IPhysicsWorldComponent<D, R, PTypeDoc>,
> {
  private static default_name_counter = 0;
  private static _documentWorlds: GgWorld<any, any>[] = [];
  static get documentWorlds(): GgWorld<any, any>[] {
    return [...GgWorld._documentWorlds];
  }

  public readonly worldClock: PausableClock = GgGlobalClock.instance.createChildClock(false);
  public readonly keyboardInput: KeyboardInput = new KeyboardInput();

  public name: string = 'w0x' + (GgWorld.default_name_counter++).toString(16);

  readonly children: IEntity[] = [];
  // the same as children, but sorted by tick order
  protected readonly tickListeners: IEntity[] = [];

  // events
  public readonly tickStarted$: Subject<void> = new Subject<void>();
  public readonly tickForwardTo$: Subject<IEntity | 'PHYSICS_WORLD'> = new Subject<IEntity | 'PHYSICS_WORLD'>();
  public readonly tickForwardedTo$: Subject<IEntity | 'PHYSICS_WORLD'> = new Subject<IEntity | 'PHYSICS_WORLD'>();

  protected constructor(public readonly visualScene: VS, public readonly physicsWorld: PW) {
    GgWorld._documentWorlds.push(this);
    this.keyboardInput.start();
    if ((window as any).ggstatic) {
      (window as any).ggstatic.registerConsoleCommand(
        this,
        'ph_timescale',
        async (...args: string[]) => {
          this.worldClock.timeScale = +args[0];
          return JSON.stringify(this.worldClock.timeScale);
        },
        'args: [float]; change time scale of physics engine. Default value is 1.0',
      );
      (window as any).ggstatic.registerConsoleCommand(
        this,
        'ls_renderers',
        async () => {
          return this.children
            .filter(e => e instanceof IRendererEntity)
            .map(r => r.name)
            .join('\n');
        },
        'no args; print all renderers in selected world',
      );
      (window as any).ggstatic.registerConsoleCommand(
        this,
        'dr_drawphysics',
        async (...args: string[]) => {
          const value = ['1', 'true', '+'].includes(args[0]);
          const rendererName = args[1];
          let renderer: IEntity;
          if (rendererName) {
            renderer = this.children.find(x => x instanceof IRendererEntity && x.name === rendererName)!;
          } else {
            renderer = this.children.find(x => x instanceof IRendererEntity)!;
          }
          if (renderer) {
            (renderer as IRendererEntity<unknown, unknown>).physicsDebugViewActive = value;
            return '' + value;
          }
          return 'false';
        },
        'args: [0 or 1] or [0 or 1, string]; turn on/off physics debug view. Second argument expects renderer ' +
          'name, if not provided first renderer will be picked. Look up for renderer names using command "ls_renderers"',
      );
      (window as any).ggstatic.registerConsoleCommand(
        this,
        'performance_report',
        async (...args: string[]) => {
          let samples = +args[0];
          if (!samples || isNaN(samples)) {
            samples = 20;
          }
          const meter = new PerformanceMeterEntity(samples, 100);
          this.addEntity(meter);
          await lastValueFrom(this.worldClock.tick$.pipe(take(samples)));
          const report = meter.report;
          this.removeEntity(meter);
          let result = `Performance report (${samples} samples)\n`;
          let color = 'lightgreen';
          if (report.totalTime > 12) {
            color = report.totalTime < 16 ? 'yellow' : 'red';
          }
          result += `<span style='color:lightgray;'>Frame time:</span>`;
          for (let i = 0; i < 40; i++) {
            result += '&nbsp;';
          }
          result += `<span style='color:${color};'>${report.totalTime.toFixed(3)} ms</span>\n`;
          for (const [name, value] of report.entries) {
            result += `<span style='color:lightgray;'>${name}:</span>`;
            for (let i = 0; i < 50 - name.length; i++) {
              result += '&nbsp;';
            }
            result += `${value.toFixed(3)} ms (${((value * 100) / report.totalTime).toFixed(2)}%)\n`;
          }
          return result;
        },
        'args: [int] or []; measure how much time was spent per entity in world. Argument is samples amount, ' +
          '20 by default, one sample per frame',
      );
    }
  }

  public async init() {
    await Promise.all([this.physicsWorld.init(), this.visualScene.init()]);
    this.worldClock.tick$.subscribe(([elapsed, delta]) => {
      this.tickStarted$.next();
      let i = 0;
      // emit tick to all entities with tick order < GGTickOrder.PHYSICS_SIMULATION
      for (i; i < this.tickListeners.length; i++) {
        if (this.tickListeners[i].tickOrder >= TickOrder.PHYSICS_SIMULATION) {
          break;
        }
        if (this.tickListeners[i].active) {
          this.tickForwardTo$.next(this.tickListeners[i]);
          this.tickListeners[i].tick$.next([elapsed, delta]);
          this.tickForwardedTo$.next(this.tickListeners[i]);
        }
      }
      // run physics simulation
      this.tickForwardTo$.next('PHYSICS_WORLD');
      this.physicsWorld.simulate(delta);
      this.tickForwardedTo$.next('PHYSICS_WORLD');
      // emit tick to all remained entities
      for (i; i < this.tickListeners.length; i++) {
        if (this.tickListeners[i].active) {
          this.tickForwardTo$.next(this.tickListeners[i]);
          this.tickListeners[i].tick$.next([elapsed, delta]);
          this.tickForwardedTo$.next(this.tickListeners[i]);
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
    if ((window as any).ggstatic) {
      (window as any).ggstatic.deregisterWorldCommands(this);
    }
    this.worldClock.stop();
    this.keyboardInput.stop();
    this.tickStarted$.complete();
    this.tickForwardTo$.complete();
    this.tickForwardedTo$.complete();
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
    descr: unknown, // type defined in subclasses
    position?: D,
    rotation?: R,
    material?: unknown, // type defined in subclasses
  ): IPositionable<D, R> & IRenderableEntity<D, R, VTypeDoc>;

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
}
