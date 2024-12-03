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
import { lastValueFrom, Subject, take } from 'rxjs';
import { PerformanceMeterEntity } from '../dev';

export type VisualTypeDocRepo<D, R> = {
  factory: unknown;
  displayObject: IDisplayObjectComponent<D, R>;
  renderer: IRendererComponent<D, R>;
  rendererExtraOpts: {};
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
  static readonly worldCreated$: Subject<GgWorld<any, any>> = new Subject();

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
  public readonly paused$: Subject<boolean> = new Subject<boolean>();
  public readonly disposed$: Subject<void> = new Subject<void>();

  protected constructor(
    public readonly visualScene: VS,
    public readonly physicsWorld: PW,
  ) {
    this.keyboardInput.start();
    if ((window as any).ggstatic) {
      this.registerConsoleCommands((window as any).ggstatic);
    } else {
      this.onGgStaticInitialized = this.onGgStaticInitialized.bind(this);
      window.addEventListener('ggstatic_added', this.onGgStaticInitialized);
    }
    this.worldClock.paused$.subscribe(this.paused$);
    GgWorld._documentWorlds.push(this);
    GgWorld.worldCreated$.next(this);
  }

  public async init() {
    await Promise.all([this.physicsWorld.init(), this.visualScene.init()]);
    const forwardTick = (listener: IEntity, elapsed: number, delta: number) => {
      if (listener.active) {
        this.tickForwardTo$.next(listener);
        listener.tick$.next([elapsed, delta]);
        this.tickForwardedTo$.next(listener);
      }
    };
    this.worldClock.tick$.subscribe(([elapsed, delta]) => {
      this.tickStarted$.next();
      let i = 0;
      // emit tick to all entities with tick order < GGTickOrder.PHYSICS_SIMULATION
      for (i; i < this.tickListeners.length; i++) {
        if (this.tickListeners[i].tickOrder >= TickOrder.PHYSICS_SIMULATION) {
          break;
        }
        forwardTick(this.tickListeners[i], elapsed, delta);
      }
      // run physics simulation
      this.tickForwardTo$.next('PHYSICS_WORLD');
      this.physicsWorld.simulate(delta);
      this.tickForwardedTo$.next('PHYSICS_WORLD');
      // emit tick to all remained entities
      for (i; i < this.tickListeners.length; i++) {
        forwardTick(this.tickListeners[i], elapsed, delta);
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
    } else {
      window.removeEventListener('ggstatic_added', this.onGgStaticInitialized);
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
    GgWorld._documentWorlds.splice(GgWorld._documentWorlds.indexOf(this), 1);
    this.disposed$.next();
    this.disposed$.complete();
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

  private onGgStaticInitialized() {
    window.removeEventListener('ggstatic_added', this.onGgStaticInitialized);
    this.registerConsoleCommands((window as any).ggstatic);
  }

  protected registerConsoleCommands(ggstatic: {
    registerConsoleCommand: (
      world: GgWorld<any, any> | null,
      command: string,
      handler: (...args: string[]) => Promise<string>,
      doc?: string,
    ) => void;
  }) {
    ggstatic.registerConsoleCommand(
      this,
      'ph_timescale',
      async (...args: string[]) => {
        this.worldClock.timeScale = +args[0];
        return JSON.stringify(this.worldClock.timeScale);
      },
      'args: [float]; change time scale of physics engine. Default value is 1.0',
    );
    ggstatic.registerConsoleCommand(
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
    ggstatic.registerConsoleCommand(
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
    ggstatic.registerConsoleCommand(
      this,
      'performance_report',
      async (...args: string[]) => {
        let mode: 'avg' | 'peak' = 'avg';
        let samples = 20;
        for (let i = 0; i < 2; i++) {
          if (['avg', 'peak'].includes(args[i])) {
            mode = args[i] as any;
          } else if (!isNaN(+args[i])) {
            samples = +args[i];
          }
        }
        const meter = new PerformanceMeterEntity(samples, 250);
        this.addEntity(meter);
        await lastValueFrom(this.worldClock.tick$.pipe(take(samples)));
        const report = mode === 'avg' ? meter.avgReport : meter.peakReport;
        this.removeEntity(meter);

        const renderItems: string[] = report.entries.map(
          ([name, value]) =>
            `<span style='color:lightgray;'>${name}:</span>` +
            new Array(Math.max(0, 26 - name.length)).join('&nbsp;') +
            `${value.toFixed(2)} ms` +
            (mode === 'avg' ? ` (${((value * 100) / report.totalTime).toFixed(2)}%)` : ''),
        );
        let totalColor = 'lightgreen';
        if (report.totalTime > 12) {
          totalColor = report.totalTime < 16 ? 'yellow' : 'red';
        }
        const title = `${mode === 'avg' ? 'Average' : 'Peak'} Frame time`;
        renderItems.unshift(
          title +
            ':' +
            new Array(Math.max(0, 26 - title.length)).join('&nbsp;') +
            `<span style='color:${totalColor};'>${report.totalTime.toFixed(2)} ms</span>`,
        );
        renderItems.unshift(`Performance report (${samples} samples)`);
        return renderItems.join('\n');
      },
      'args: [int, avg|peak]; [avg|peak, int]; [avg|peak]; [int] or []; measure how much time was spent per ' +
        'entity in world. Arguments are samples amount (20 by default) and "peak" or "avg" choice, both arguments are ' +
        'optional. "avg" report sorts entities by average time consumed, "peak" records highest value for each entity',
    );
  }
}
