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
  public readonly worldClock: PausableClock = GgGlobalClock.instance.createChildClock(false);
  public readonly keyboardInput: KeyboardInput = new KeyboardInput();

  private static default_name_counter = 0;
  public name: string = 'w0x' + (GgWorld.default_name_counter++).toString(16);

  readonly children: IEntity[] = [];
  // the same as children, but sorted by tick order
  protected readonly tickListeners: IEntity[] = [];

  private static _documentWorlds: GgWorld<any, any>[] = [];
  static get documentWorlds(): GgWorld<any, any>[] {
    return [...GgWorld._documentWorlds];
  }

  protected constructor(public readonly visualScene: VS, public readonly physicsWorld: PW) {
    GgWorld._documentWorlds.push(this);
    this.keyboardInput.start();
    if ((window as any).ggstatic) {
      (window as any).ggstatic.registerConsoleCommand(
        this,
        'show_debugger',
        async (...args: string[]) => {
          (window as any).ggstatic.showDebugControls = ['1', 'true', '+'].includes(args[0]);
          return '' + (window as any).ggstatic.showDebugControls;
        },
        'args: [0 or 1]; turn on/off debug panel. Default value is 0',
      );
      (window as any).ggstatic.registerConsoleCommand(
        this,
        'show_stats',
        async (...args: string[]) => {
          (window as any).ggstatic.showStats = ['1', 'true', '+'].includes(args[0]);
          return '' + (window as any).ggstatic.showStats;
        },
        'args: [0 or 1]; turn on/off stats. Default value is 0',
      );
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
        'dr_drawphysics',
        async (...args: string[]) => {
          const value = ['1', 'true', '+'].includes(args[0]);
          const renderer = this.children.find(x => x instanceof IRendererEntity);
          if (renderer) {
            (renderer as IRendererEntity<unknown, unknown>).physicsDebugViewActive = value;
            return '' + value;
          }
          return 'false';
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
      // run physics simulation
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
    if ((window as any).ggstatic) {
      (window as any).ggstatic.deregisterWorldCommands(this);
    }
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
