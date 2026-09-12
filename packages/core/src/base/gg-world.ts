import {
  IAudioSceneComponent,
  IAudioSourceComponent,
  IAudioSourceComponentFactory,
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
import { IVisualScene2dComponent, VisualTypeDocRepo2D } from '../2d';

export type VisualTypeDocRepo<D, R> = {
  factory: unknown;
  displayObject: IDisplayObjectComponent<D, R>;
  renderer: IRendererComponent<D, R>;
  rendererExtraOpts: {};
  camera: IPositionable<D, R>;
};

export type PhysicsTypeDocRepo<D, R> = {
  factory: unknown;
  rigidBody: IRigidBodyComponent<D, R>;
  trigger: ITriggerComponent<D, R>;
};

export type AudioTypeDocRepo<D, R> = {
  factory: IAudioSourceComponentFactory<D, R>;
  source: IAudioSourceComponent<D, R>;
  clip: unknown;
};

export type GgWorldTypeDocRepo<D, R> = {
  vTypeDoc: VisualTypeDocRepo<D, R>;
  pTypeDoc: PhysicsTypeDocRepo<D, R>;
  aTypeDoc: AudioTypeDocRepo<D, R>;
};
// utility types to create world type doc by defining either vTypeDoc, pTypeDoc or aTypeDoc only
export type GgWorldTypeDocVPatch<D, R, VTypeDoc extends VisualTypeDocRepo<D, R>> = Omit<
  GgWorldTypeDocRepo<D, R>,
  'vTypeDoc'
> & {
  vTypeDoc: VTypeDoc;
};
export type GgWorldTypeDocPPatch<D, R, PTypeDoc extends PhysicsTypeDocRepo<D, R>> = Omit<
  GgWorldTypeDocRepo<D, R>,
  'pTypeDoc'
> & {
  pTypeDoc: PTypeDoc;
};
export type GgWorldTypeDocAPatch<D, R, ATypeDoc extends AudioTypeDocRepo<D, R>> = Omit<
  GgWorldTypeDocRepo<D, R>,
  'aTypeDoc'
> & {
  aTypeDoc: ATypeDoc;
};

export type GgWorldSceneTypeRepo<D, R, TypeDoc extends GgWorldTypeDocRepo<D, R> = GgWorldTypeDocRepo<D, R>> = {
  visualScene: IVisualSceneComponent<D, R, TypeDoc['vTypeDoc']> | null;
  physicsWorld: IPhysicsWorldComponent<D, R, TypeDoc['pTypeDoc']> | null;
  audioScene: IAudioSceneComponent<D, R, TypeDoc['aTypeDoc']> | null;
};
// utility types to create world scene type doc by defining either visualScene, physicsWorld or audioScene only
export type GgWorldSceneTypeDocVPatch<
  D,
  R,
  VTypeDoc extends VisualTypeDocRepo2D,
  VS extends IVisualScene2dComponent<VTypeDoc> | null,
> = Omit<GgWorldSceneTypeRepo<D, R>, 'visualScene'> & { visualScene: VS };
export type GgWorldSceneTypeDocPPatch<
  D,
  R,
  PTypeDoc extends PhysicsTypeDocRepo<D, R>,
  PW extends IPhysicsWorldComponent<D, R, PTypeDoc> | null,
> = Omit<GgWorldSceneTypeRepo<D, R>, 'physicsWorld'> & { physicsWorld: PW };
export type GgWorldSceneTypeDocAPatch<
  D,
  R,
  ATypeDoc extends AudioTypeDocRepo<D, R>,
  AS extends IAudioSceneComponent<D, R, ATypeDoc> | null,
> = Omit<GgWorldSceneTypeRepo<D, R>, 'audioScene'> & { audioScene: AS };

// utility types to get type docs from world, can be used when defining custom entities
export type TypeDocOf<W extends GgWorld<any, any>> =
  W extends GgWorld<infer D, infer R, infer TypeDoc> ? TypeDoc : never;
export type SceneTypeDocOf<W extends GgWorld<any, any>> =
  W extends GgWorld<infer D, infer R, infer TypeDoc, infer SceneTypeDoc> ? SceneTypeDoc : never;

export abstract class GgWorld<
  D,
  R,
  TypeDoc extends GgWorldTypeDocRepo<D, R> = GgWorldTypeDocRepo<D, R>,
  SceneTypeDoc extends GgWorldSceneTypeRepo<D, R, TypeDoc> = GgWorldSceneTypeRepo<D, R, TypeDoc>,
> {
  private static default_name_counter = 0;
  private static _documentWorlds: GgWorld<any, any>[] = [];
  static readonly worldCreated$: Subject<GgWorld<any, any>> = new Subject();

  static get documentWorlds(): GgWorld<any, any>[] {
    return [...GgWorld._documentWorlds];
  }

  public readonly visualScene: SceneTypeDoc['visualScene'];
  public readonly physicsWorld: SceneTypeDoc['physicsWorld'];
  public readonly audioScene: SceneTypeDoc['audioScene'];

  public readonly worldClock: PausableClock = new PausableClock(false);
  public readonly keyboardInput: KeyboardInput = new KeyboardInput();

  public name: string = 'w0x' + (GgWorld.default_name_counter++).toString(16);

  readonly children: IEntity[] = [];
  // the same as children, but sorted by tick order
  protected readonly tickListeners: IEntity[] = [];

  public get renderers(): IRendererEntity<D, R>[] {
    return this.tickListeners.filter(e => e instanceof IRendererEntity) as IRendererEntity<D, R>[];
  }

  // events
  public readonly tickStarted$: Subject<void> = new Subject<void>();
  public readonly tickForwardTo$: Subject<IEntity | 'PHYSICS_WORLD'> = new Subject<IEntity | 'PHYSICS_WORLD'>();
  public readonly tickForwardedTo$: Subject<IEntity | 'PHYSICS_WORLD'> = new Subject<IEntity | 'PHYSICS_WORLD'>();
  public readonly paused$: Subject<boolean> = new Subject<boolean>();
  public readonly disposed$: Subject<void> = new Subject<void>();

  protected constructor(args: {
    visualScene?: SceneTypeDoc['visualScene'];
    physicsWorld?: SceneTypeDoc['physicsWorld'];
    audioScene?: SceneTypeDoc['audioScene'];
  }) {
    this.visualScene = args.visualScene || null;
    this.physicsWorld = args.physicsWorld || null;
    this.audioScene = args.audioScene || null;
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
    const initPromises = [];
    if (this.visualScene) {
      initPromises.push(this.visualScene.init());
    }
    if (this.physicsWorld) {
      initPromises.push(this.physicsWorld.init());
    }
    if (this.audioScene) {
      initPromises.push(this.audioScene.init());
    }
    await Promise.all(initPromises);
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
      if (this.physicsWorld) {
        this.tickForwardTo$.next('PHYSICS_WORLD');
        this.physicsWorld.simulate(delta);
        this.tickForwardedTo$.next('PHYSICS_WORLD');
      }
      // emit tick to all remained entities
      for (i; i < this.tickListeners.length; i++) {
        forwardTick(this.tickListeners[i], elapsed, delta);
      }
      // update the audio listener (and, for adapters with no native distance panning, every
      // living spatial source) from whatever entities moved this frame - see
      // IAudioSceneComponent.update's doc for why this runs last
      if (this.audioScene) {
        this.audioScene.update(elapsed, delta);
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
    return new PausableClock(autoStart, this.worldClock);
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
    if (this.physicsWorld) {
      this.physicsWorld.dispose();
    }
    if (this.visualScene) {
      this.visualScene.dispose();
    }
    if (this.audioScene) {
      this.audioScene.dispose();
    }
    GgWorld._documentWorlds.splice(GgWorld._documentWorlds.indexOf(this), 1);
    this.disposed$.next();
    this.disposed$.complete();
  }

  abstract addPrimitiveRigidBody(
    descr: unknown, // type defined in subclasses
    position?: D,
    rotation?: R,
    material?: unknown, // type defined in subclasses
  ): IPositionable<D, R> & IRenderableEntity<D, R, TypeDoc>;

  public addEntity(entity: IEntity): void {
    if (entity.world === this) {
      // Already a member of this world - e.g. reparented (via addChildren) after having been
      // added directly, as level-loaded entities are. Not an error: just a no-op, since
      // addChildren already updated the parent/children bookkeeping before calling back in here.
      return;
    }
    if (entity.world) {
      console.warn('Trying to spawn entity, which is already spawned');
      return;
    }
    this.children.push(entity);
    this.tickListeners.push(entity);
    this.tickListeners.sort((l1, l2) => l1.tickOrder - l2.tickOrder);
    entity.onSpawned(this);
    this.maybeBindAudioListener(entity);
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

  /**
   * Find an entity anywhere in the world by name. `children` is a flat list of every entity ever
   * added via `addEntity` (nested entities included - `addChildren`/`onSpawned` cascade into it
   * too), so this is a plain linear scan, not a tree walk; to search inside one particular
   * entity's own subtree instead, use `IEntity.getChildEntityByName`.
   * @param name - The entity's `name`
   * @returns The first entity found with that name (insertion order), if more than one shares it
   * @throws if no entity in the world has that name
   */
  public getEntityByName<T extends IEntity = IEntity>(name: string): T {
    const found = this.children.find(e => e.name === name);
    if (!found) {
      throw new Error(`No entity named "${name}" found in the world`);
    }
    return found as T;
  }

  /**
   * Auto-bind `audioScene`'s listener the first time this world ends up with exactly one
   * renderer, so a single-camera app never has to call `setActiveListener` itself. Deliberately
   * does *not* guess once a second renderer shows up (e.g. a portal/minimap camera, or a second
   * split-screen player) - it warns instead, since silently picking one would be a much harder
   * bug to notice than an explicit console warning naming every renderer present. See the audio
   * RFC's "The listener problem" section.
   */
  private audioListenerAutoBound = false;

  private maybeBindAudioListener(entity: IEntity): void {
    if (!this.audioScene || !(entity instanceof IRendererEntity)) {
      return;
    }
    // An explicitly app-set listener (activeListener !== null and we didn't set it ourselves) is
    // never touched or warned about, no matter how many renderers show up afterwards. A listener
    // *this* method auto-bound is different: a later second renderer must still trigger the
    // warning below, so the "already has a listener" check alone (used before this flag existed)
    // isn't enough - it would silently skip the warning once the first renderer auto-bound one.
    if (this.audioScene.activeListener !== null && !this.audioListenerAutoBound) {
      return;
    }
    const renderers = this.renderers;
    if (renderers.length === 1) {
      this.audioScene.setActiveListener(renderers[0].camera);
      this.audioListenerAutoBound = true;
    } else if (renderers.length > 1) {
      console.warn(
        `GgWorld "${this.name}": ${renderers.length} renderers present and no active audio ` +
          `listener set (${renderers.map(r => r.name).join(', ')}) - call ` +
          `world.audioScene.setActiveListener(...) explicitly to choose one.`,
      );
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
      'timescale',
      async (...args: string[]) => {
        if (!isNaN(+args[0])) {
          this.worldClock.timeScale = +args[0];
        }
        return this.worldClock.timeScale.toString();
      },
      'args: [ float? ]; Get current time scale of selected world clock or set it.' +
        ' Default value is 1.0 (no time scale applied)',
    );
    ggstatic.registerConsoleCommand(
      this,
      'fps_limit',
      async (...args: string[]) => {
        if (!isNaN(+args[0])) {
          this.worldClock.tickRateLimit = +args[0];
        }
        return this.worldClock.tickRateLimit.toString();
      },
      'args: [ int? ]; Get current tick rate limit of selected world clock or set it. 0 means no limit applied',
    );
    ggstatic.registerConsoleCommand(
      this,
      'step',
      async (...args: string[]) => {
        if (!this.worldClock.isPaused) {
          throw new Error('World must be paused first (run "timescale 0") before it can be stepped');
        }
        const ms = args[0] === undefined ? 1000 / 120 : +args[0];
        if (isNaN(ms) || ms <= 0) {
          throw new Error('usage: step [ms]; ms must be a positive number');
        }
        this.worldClock.step(ms);
        return `stepped ${ms} ms`;
      },
      'args: [ float? ]; Advance a paused world clock by exactly one tick of the given duration ' +
        'in milliseconds (default 8, i.e. 1000/120). Only works while the world is paused via ' +
        '"timescale 0"; rejects otherwise',
    );
    ggstatic.registerConsoleCommand(
      this,
      'renderers',
      async () => {
        return this.renderers.map(r => r.name).join('\n');
      },
      'no args; Print all renderers in selected world',
    );
    ggstatic.registerConsoleCommand(
      this,
      'debug_view',
      async (...args: string[]) => {
        let value: boolean | 'toggle' = 'toggle';
        let rendererName: string | undefined = undefined;
        for (let arg of args) {
          if (['1', '0'].includes(arg)) {
            value = arg === '1';
          } else {
            rendererName = arg;
          }
        }
        let renderer = rendererName ? this.renderers.find(x => x.name === rendererName) : this.renderers[0];
        if (renderer) {
          renderer.physicsDebugViewActive = value === 'toggle' ? !renderer.physicsDebugViewActive : value;
          return renderer.physicsDebugViewActive ? '1' : '0';
        } else if (rendererName) {
          throw new Error(`Renderer with name "${rendererName}" not found`);
        } else {
          throw new Error(`No renderer found`);
        }
      },
      'args: [ 0|1?, string? ]; Turn on/off physics debug view, skip first argument to toggle value.' +
        ' Second argument expects renderer name, if not provided first renderer will be picked.' +
        ' Use "renderers" to get list of renderers in the world',
    );
    ggstatic.registerConsoleCommand(
      this,
      'performance',
      async (...args: string[]) => {
        let mode: 'avg' | 'peak' = 'avg';
        let samples = 20;
        for (let arg of args) {
          if (['avg', 'peak'].includes(arg)) {
            mode = arg as any;
          } else if (!isNaN(+arg)) {
            samples = +arg;
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
      'args: [ int?, avg|peak? ]; Measure how much time was spent per ' +
        'entity in world. Arguments are samples amount (20 by default) and "peak" or "avg" choice, both arguments are ' +
        'optional. "avg" report sorts entities by average time consumed, "peak" records highest value for each entity',
    );
    ggstatic.registerConsoleCommand(
      this,
      'entities',
      async (...args: string[]) => {
        const filter = args[0]?.toLowerCase();
        const list = this.children.filter(e => !filter || e.name.toLowerCase().includes(filter));
        if (list.length === 0) {
          return '<span style="color:#aaa">(no entities)</span>';
        }
        return list
          .map(
            e => `<span style='color:yellow'>${e.name}</span>\t<span style='color:#aaa'>${e.constructor.name}</span>`,
          )
          .join('\n');
      },
      'args: [ string? ]; List all entities in this world (name and class), optionally filtered by ' +
        'a case-insensitive substring of the name. Use "entity NAME" to inspect one of them',
    );
    ggstatic.registerConsoleCommand(
      this,
      'entity',
      async (...args: string[]) => {
        const name = args[0];
        if (!name) {
          throw new Error('usage: entity NAME; use "entities" to list available names');
        }
        const entity = this.getEntityByName(name);
        const lines: string[] = [
          `class: ${entity.constructor.name}`,
          `active: ${entity.active}`,
          `parent: ${entity.parent ? entity.parent.name : '(none)'}`,
        ];
        if ('visible' in entity) {
          lines.push(`visible: ${(entity as any).visible}`);
        }
        if ('position' in entity) {
          lines.push(`position: ${JSON.stringify((entity as any).position)}`);
        }
        if ('rotation' in entity) {
          lines.push(`rotation: ${JSON.stringify((entity as any).rotation)}`);
        }
        lines.push(
          `children: ${entity.children.length === 0 ? '(none)' : entity.children.map(c => c.name).join(', ')}`,
        );
        return lines.join('\n');
      },
      'args: [ string ]; Print class, position/rotation (if any) and children of one entity. Use ' +
        '"entities" to list available names, "set_position"/"set_rotation" to move it',
    );
    ggstatic.registerConsoleCommand(
      this,
      'remove',
      async (...args: string[]) => {
        const name = args[0];
        if (!name) {
          throw new Error('usage: remove NAME [dispose=0|1]');
        }
        const entity = this.getEntityByName(name);
        const dispose = args[1] === undefined ? true : args[1] === '1';
        this.removeEntity(entity, dispose);
        return `removed "${name}"`;
      },
      'args: [ string, 0|1? ]; Remove the named entity from this world, disposing it by default. ' +
        'Pass 0 as second arg to detach without disposing (e.g. before re-adding it elsewhere)',
    );
    if (this.audioScene) {
      ggstatic.registerConsoleCommand(
        this,
        'audio_set_listener',
        async (...args: string[]) => {
          const name = args[0];
          if (!name) {
            throw new Error('usage: audio_set_listener NAME; use "renderers" to list renderer names');
          }
          const renderer = this.renderers.find(r => r.name === name);
          if (renderer) {
            this.audioScene!.setActiveListener(renderer.camera);
            return `listener bound to renderer "${name}"`;
          }
          const entity = this.getEntityByName(name);
          if (!('position' in entity) || !('rotation' in entity)) {
            throw new Error(`Entity "${name}" (${entity.constructor.name}) is not positionable`);
          }
          this.audioScene!.setActiveListener(entity as unknown as IPositionable<D, R>);
          return `listener bound to "${name}"`;
        },
        'args: [ string ]; Set the world audio listener to a renderer or positionable entity by ' +
          'name. Use "renderers"/"entities" to find names. Needed once a world runs more than one ' +
          'renderer - see the audio subsystem doc for why this is never guessed automatically',
      );
      ggstatic.registerConsoleCommand(
        this,
        'audio_master_volume',
        async (...args: string[]) => {
          if (args.length > 0) {
            if (isNaN(+args[0])) {
              throw new Error('usage: audio_master_volume [float]');
            }
            this.audioScene!.masterVolume = +args[0];
          }
          return this.audioScene!.masterVolume.toString();
        },
        'args: [ float? ]; Get or set the world audio scene master volume (0-1)',
      );
      ggstatic.registerConsoleCommand(
        this,
        'audio_bus_volume',
        async (...args: string[]) => {
          const [bus, value] = args;
          if (!bus) {
            throw new Error('usage: audio_bus_volume BUS [float]');
          }
          if (value !== undefined) {
            if (isNaN(+value)) {
              throw new Error('usage: audio_bus_volume BUS [float]');
            }
            this.audioScene!.setBusVolume(bus, +value);
          }
          return this.audioScene!.getBusVolume(bus).toString();
        },
        'args: [ string, float? ]; Get or set the volume (0-1) of one audio bus (e.g. "sfx", ' +
          '"music", "ambient") - a bus not otherwise set behaves as if its volume were 1',
      );
    }
  }
}
