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
  warnOnce,
} from '../base';
import { lastValueFrom, Observable, Subject, take } from 'rxjs';
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

  /**
   * When `true`, this world pauses itself automatically while the document/tab is hidden
   * (`document.visibilitychange`, checked via `document.hidden`) and resumes itself once visible
   * again - but only if the world wasn't already paused by app code at the moment it went hidden.
   * A world the app paused itself stays paused across a hide/show cycle; this flag never resumes
   * it. Defaults to `false`. The subscription is set up in `init()` and torn down in `dispose()`;
   * on a host with no `document` (e.g. a non-browser/jsdom-less test harness) this is a no-op -
   * nothing ever gets paused/resumed by visibility regardless of this flag.
   */
  public readonly pauseWhenHidden: boolean;

  private readonly _visibility$: Subject<boolean> = new Subject<boolean>();

  /**
   * Emits the document/tab's visibility state (`true` = visible, `false` = hidden) every time it
   * changes, regardless of `pauseWhenHidden` - apps can subscribe directly (e.g. to mute audio, or
   * drop network updates while hidden) without opting into the auto-pause behavior. On a host with
   * no `document` (jsdom-less tests, non-browser hosts) this simply never emits - a safe no-op
   * fallback rather than throwing.
   */
  public readonly visibility$: Observable<boolean> = this._visibility$.asObservable();

  private visibilityChangeListener: (() => void) | null = null;
  // set exactly when pauseWhenHidden's own visibilitychange handler is the one that paused the
  // world - so its own "visible again" branch only ever resumes a world *it* paused, never one the
  // app paused itself independently
  private pausedByVisibility: boolean = false;

  /**
   * When set, `physicsWorld.simulate()` is driven by a fixed-timestep accumulator instead of the
   * raw per-tick delta - see the constructor's `fixedPhysicsStep` argument doc for the full
   * semantics.
   */
  public readonly fixedPhysicsStep?: number;

  /**
   * Spiral-of-death guard for the `fixedPhysicsStep` accumulator: the most `simulate()` calls one
   * world tick is allowed to make before the remaining accumulated time is dropped instead of
   * carried over. Only meaningful when `fixedPhysicsStep` is set. Defaults to 8.
   */
  public readonly maxPhysicsStepsPerTick: number;

  // Leftover, not-yet-simulated tick time, in ms, when `fixedPhysicsStep` is set - see the tick
  // loop in `init()`.
  private physicsAccumulator: number = 0;

  public name: string = 'w0x' + (GgWorld.default_name_counter++).toString(16);

  readonly children: IEntity[] = [];
  // the same as children, but sorted by tick order
  protected readonly tickListeners: IEntity[] = [];
  // name -> entity index over every entity in `children`, kept in sync by addEntity/removeEntity/
  // renameEntity/dispose - backs getEntityByName and enforces world-wide name uniqueness
  private readonly entitiesByName: Map<string, IEntity> = new Map();

  public get renderers(): IRendererEntity<D, R>[] {
    return this.tickListeners.filter(e => e instanceof IRendererEntity) as IRendererEntity<D, R>[];
  }

  // events
  public readonly tickStarted$: Subject<void> = new Subject<void>();
  public readonly tickForwardTo$: Subject<IEntity | 'PHYSICS_WORLD'> = new Subject<IEntity | 'PHYSICS_WORLD'>();
  public readonly tickForwardedTo$: Subject<IEntity | 'PHYSICS_WORLD'> = new Subject<IEntity | 'PHYSICS_WORLD'>();
  public readonly paused$: Subject<boolean> = new Subject<boolean>();
  public readonly disposed$: Subject<void> = new Subject<void>();

  // emits `entity` once its spawn has fully succeeded - see `addEntity`'s own doc for exactly when
  private readonly _entityAdded$: Subject<IEntity> = new Subject<IEntity>();
  // emits `entity` once it has been fully removed - see `removeEntity`'s own doc for exactly when
  private readonly _entityRemoved$: Subject<IEntity> = new Subject<IEntity>();

  /**
   * Emits an entity once its spawn into this world has fully succeeded: after `IEntity.onSpawned`
   * has returned without throwing, so `entity.world` is already set and every one of its components
   * has already had `addToWorld` called - i.e. it's fully usable at the point of emission, not just
   * registered. A nested entity spawned as part of `onSpawned`'s own cascade (a child of an entity
   * passed to `addEntity`, added via `addChildren` before the parent itself is spawned) emits its
   * own event too, at the point its own nested `addEntity` call succeeds - which happens before the
   * parent's own event, since the parent's `onSpawned` (and so its own success) only completes once
   * every child has already finished spawning.
   *
   * Never emits for an `addEntity` call that throws (a name collision, or a component/child failing
   * partway through the atomic spawn - see `addEntity`'s own doc) - rolled-back entities never
   * successfully attached to anything, so there is nothing to report. Completes in `dispose()`.
   */
  public get entityAdded$(): Observable<IEntity> {
    return this._entityAdded$.asObservable();
  }

  /**
   * Emits an entity once it has been fully removed from this world: after `IEntity.onRemoved` has
   * returned, so `entity.world` is already `null` again and every component has already had
   * `removeFromWorld` called. A nested entity removed as part of `onRemoved`'s own cascade (a child
   * of the entity passed to `removeEntity`) emits its own event too, before the parent's own event,
   * mirroring `entityAdded$`'s nested-cascade ordering.
   *
   * Does not fire for an entity torn down by `dispose()` itself (top-level children there are torn
   * down directly via `onRemoved`/`dispose`, not via `removeEntity` - the world itself is going
   * away, so there is nothing left to notify) - only `entityAdded$`/`entityRemoved$` themselves
   * completing there matters. Completes in `dispose()`.
   */
  public get entityRemoved$(): Observable<IEntity> {
    return this._entityRemoved$.asObservable();
  }

  protected constructor(args: {
    visualScene?: SceneTypeDoc['visualScene'];
    physicsWorld?: SceneTypeDoc['physicsWorld'];
    audioScene?: SceneTypeDoc['audioScene'];
    /**
     * Upper bound, in milliseconds, on any single tick delta this world's `worldClock` (and
     * therefore every entity's `tick$` and `physicsWorld.simulate`) ever sees - forwarded straight
     * to `worldClock.maxTickDelta`. Defaults to `PausableClock`'s own default (250ms) when omitted;
     * pass `0` to disable clamping entirely. See `PausableClock.maxTickDelta`'s own doc for what
     * clamping does to `elapsedTime`.
     */
    maxTickDelta?: number;
    /**
     * When `true`, this world pauses itself while the document/tab is hidden and resumes itself
     * when it becomes visible again (unless the app had already paused it itself) - see
     * `GgWorld.pauseWhenHidden`'s own doc. Defaults to `false`.
     */
    pauseWhenHidden?: boolean;
    /**
     * Opt-in fixed physics timestep, in milliseconds. Left `undefined` (the default), the tick
     * loop keeps its original behavior: `physicsWorld.simulate(delta)` is called exactly once per
     * world tick, with that tick's own (variable) delta. Set to a value, the tick loop instead
     * accumulates each tick's delta and calls `physicsWorld.simulate(fixedPhysicsStep)` as many
     * times as fit in the accumulator (0 or more - a tick faster than `fixedPhysicsStep` may call
     * `simulate` zero times, letting time accumulate across ticks), carrying any leftover
     * fractional time over to the next tick. This gives the physics engine a constant, reproducible
     * step size regardless of the actual frame rate, at the cost of it running zero, one, or
     * several times within a single rendered frame. `maxPhysicsStepsPerTick` bounds how many of
     * those calls a single world tick can make.
     */
    fixedPhysicsStep?: number;
    /**
     * Spiral-of-death guard for `fixedPhysicsStep`: the most `simulate()` calls one world tick may
     * make before the rest of that tick's accumulated time is dropped instead of carried over to
     * the next tick (e.g. after the tab was backgrounded and comes back with a huge delta). Only
     * meaningful when `fixedPhysicsStep` is set. Defaults to 8. `PausableClock`'s own bounded tick
     * delta (`maxTickDelta`, where available) is a complementary safeguard at the clock level -
     * this cap is what keeps a single tick's physics work bounded even if an oversized delta
     * reaches `GgWorld` anyway.
     */
    maxPhysicsStepsPerTick?: number;
  }) {
    this.visualScene = args.visualScene || null;
    this.physicsWorld = args.physicsWorld || null;
    this.audioScene = args.audioScene || null;
    if (args.maxTickDelta !== undefined) {
      this.worldClock.maxTickDelta = args.maxTickDelta;
    }
    this.pauseWhenHidden = args.pauseWhenHidden ?? false;
    this.fixedPhysicsStep = args.fixedPhysicsStep;
    this.maxPhysicsStepsPerTick = args.maxPhysicsStepsPerTick ?? 8;
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
    if (typeof document !== 'undefined') {
      this.visibilityChangeListener = () => {
        const visible = document.visibilityState !== 'hidden';
        this._visibility$.next(visible);
        if (this.pauseWhenHidden) {
          if (!visible) {
            if (!this.isPaused) {
              this.pausedByVisibility = true;
              this.pauseWorld();
            }
          } else if (this.pausedByVisibility) {
            this.pausedByVisibility = false;
            this.resumeWorld();
          }
        }
      };
      document.addEventListener('visibilitychange', this.visibilityChangeListener);
    }
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
      // run physics simulation - tickForwardTo$/tickForwardedTo$('PHYSICS_WORLD') fire exactly
      // once per world tick either way, wrapping the whole fixed-step batch below rather than each
      // individual simulate() call, so a hook listening for them can't tell how many substeps ran.
      if (this.physicsWorld) {
        this.tickForwardTo$.next('PHYSICS_WORLD');
        if (this.fixedPhysicsStep !== undefined) {
          this.physicsAccumulator += delta;
          let steps = 0;
          while (this.physicsAccumulator >= this.fixedPhysicsStep && steps < this.maxPhysicsStepsPerTick) {
            this.physicsWorld.simulate(this.fixedPhysicsStep);
            this.physicsAccumulator -= this.fixedPhysicsStep;
            steps++;
          }
          if (steps >= this.maxPhysicsStepsPerTick && this.physicsAccumulator >= this.fixedPhysicsStep) {
            // spiral-of-death guard: this tick alone accumulated more time than
            // maxPhysicsStepsPerTick fixed steps can consume (e.g. a huge delta from a
            // backgrounded tab) - drop the rest rather than let the debt grow tick over tick.
            warnOnce(
              `GgWorld "${this.name}": fixedPhysicsStep accumulator exceeded maxPhysicsStepsPerTick ` +
                `(${this.maxPhysicsStepsPerTick}) in one tick - dropping the remaining accumulated time`,
            );
            this.physicsAccumulator = 0;
          }
        } else {
          this.physicsWorld.simulate(delta);
        }
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
    if (this.visibilityChangeListener) {
      document.removeEventListener('visibilitychange', this.visibilityChangeListener);
      this.visibilityChangeListener = null;
    }
    this.worldClock.stop();
    this.keyboardInput.stop();
    this.tickStarted$.complete();
    this.tickForwardTo$.complete();
    this.tickForwardedTo$.complete();
    this._entityAdded$.complete();
    this._entityRemoved$.complete();
    for (let i = 0; i < this.children.length; i++) {
      this.children[i].onRemoved();
      this.children[i].dispose();
    }
    this.children.splice(0, this.children.length);
    this.tickListeners.splice(0, this.tickListeners.length);
    this.entitiesByName.clear();
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

  // Nesting depth of the addEntity call chain currently in progress - `onSpawned` cascades into
  // `addEntity` for every child, and the subtree-wide name validation only needs to run once, at
  // the outermost call, since it already covered every descendant.
  private addEntityDepth = 0;

  /**
   * Add `entity` (and, cascading through `IEntity.onSpawned`, every entity nested under it) to
   * this world. Atomic: either the whole subtree ends up spawned, or nothing changes. Every name in
   * the subtree is validated up front, before any component/child is touched, so a collision
   * (with an entity already in the world, or between two entities within the subtree itself)
   * throws without the entity's bodies or display objects ever reaching the native scenes - and
   * should spawning still throw partway for any other reason, whatever was already registered is
   * rolled back before the error propagates. Emits `entityAdded$` for `entity` once its own spawn
   * has fully succeeded - see that getter's own doc for the nested-cascade emission order.
   * @param entity - The entity to add; a no-op if it's already a member of this world
   * @throws if `entity` has already been disposed (see `IEntity.dispose()`/`disposed`) - every
   * component it owns has already freed its native resources, so nothing about it is valid to
   * attach to a world's native scenes again
   * @throws if `entity` or any of its descendants carries a name already in use by another entity
   * in this world, or shared by two entities of the subtree
   */
  public addEntity(entity: IEntity): void {
    if (entity.disposed) {
      throw new Error('Cannot add entity - it has already been disposed');
    }
    if (entity.world === this) {
      // Already a member of this world - e.g. reparented (via addChildren) after having been
      // added directly, as level-loaded entities are. Not an error: just a no-op, since
      // addChildren already updated the parent/children bookkeeping before calling back in here.
      return;
    }
    if (entity.world) {
      warnOnce('Trying to spawn entity, which is already spawned');
      return;
    }
    if (this.addEntityDepth === 0) {
      this.assertSubtreeNamesAvailable(entity);
    } else {
      // nested call (a child being cascaded into from its parent's onSpawned) - the subtree was
      // already validated by the outermost call, but a child spawned dynamically from within an
      // onSpawned hook wasn't part of that snapshot, so still check the entity itself
      this.assertNameAvailable(entity, entity.name);
    }
    this.entitiesByName.set(entity.name, entity);
    this.children.push(entity);
    this.tickListeners.push(entity);
    this.tickListeners.sort((l1, l2) => l1.tickOrder - l2.tickOrder);
    this.addEntityDepth++;
    try {
      entity.onSpawned(this);
    } catch (e) {
      // roll back to exactly the state before this call. IEntity.onSpawned already undoes its own
      // component/child loop and resets `entity.world` back to null before rethrowing, so by the
      // time a failure from that loop reaches here there is nothing left to detach - only
      // unregistering `entity` itself from this world's bookkeeping remains. The one case where
      // `entity.world` is still `this` here is a subclass override that calls `super.onSpawned()`
      // (which fully succeeded) and then throws afterward - there, everything genuinely is attached,
      // so the full `removeEntity`/`onRemoved` teardown is the correct, not merely defensive, path.
      // (cast: TS still has `entity.world` narrowed to `null` from the guard above)
      if ((entity.world as unknown) === this) {
        this.removeEntity(entity);
      } else {
        this.unregisterEntity(entity);
      }
      throw e;
    } finally {
      this.addEntityDepth--;
    }
    this.maybeBindAudioListener(entity);
    this._entityAdded$.next(entity);
  }

  /**
   * Throw if `name` can't be given to `entity` in this world, i.e. another entity already holds it.
   */
  private assertNameAvailable(entity: IEntity, name: string): void {
    const existing = this.entitiesByName.get(name);
    if (existing && existing !== entity) {
      throw new Error(`Cannot add entity - name "${name}" is already in use by another entity in this world`);
    }
  }

  /**
   * Throw if `root` or any entity nested under it (at any depth) carries a name that is already in
   * use in this world or that another entity of the same subtree also carries - checked before any
   * of them is registered, so a failing `addEntity` never leaves a partially-spawned subtree behind.
   */
  private assertSubtreeNamesAvailable(root: IEntity): void {
    const seen = new Map<string, IEntity>();
    const stack: IEntity[] = [root];
    while (stack.length) {
      const entity = stack.pop()!;
      if (entity.world) {
        // a descendant already spawned somewhere is never (re-)registered by this call - in this
        // world it keeps its registration (merely being reparented), in another world the nested
        // addEntity warns and skips it - so there is nothing to validate for it or anything under it
        continue;
      }
      this.assertNameAvailable(entity, entity.name);
      const sibling = seen.get(entity.name);
      if (sibling && sibling !== entity) {
        throw new Error(
          `Cannot add entity - name "${entity.name}" is used by more than one entity within the entity tree being added`,
        );
      }
      seen.set(entity.name, entity);
      stack.push(...entity.children);
    }
  }

  private unregisterEntity(entity: IEntity): void {
    const childIndex = this.children.indexOf(entity);
    if (childIndex >= 0) {
      this.children.splice(childIndex, 1);
    }
    const listenerIndex = this.tickListeners.indexOf(entity);
    if (listenerIndex >= 0) {
      this.tickListeners.splice(listenerIndex, 1);
    }
    if (this.entitiesByName.get(entity.name) === entity) {
      this.entitiesByName.delete(entity.name);
    }
  }

  public removeEntity(entity: IEntity, dispose = false): void {
    if (entity.world) {
      if (entity.world !== this) {
        throw new Error('Entity is not a part of this world');
      }
      this.unregisterEntity(entity);
      entity.onRemoved();
      this._entityRemoved$.next(entity);
    }
    if (dispose) {
      entity.dispose();
    }
  }

  /**
   * Update this world's name index to reflect `entity` being renamed to `newName` - called by
   * `IEntity`'s own `name` setter, not meant to be called directly. Validates uniqueness the same
   * way `addEntity` does.
   * @param entity - The entity being renamed, still reporting its *old* `name` at this point
   * @param newName - The name it's about to be renamed to
   * @throws if another entity in this world already has `newName`
   */
  public renameEntity(entity: IEntity, newName: string): void {
    if (newName === entity.name) {
      return;
    }
    const existing = this.entitiesByName.get(newName);
    if (existing && existing !== entity) {
      throw new Error(
        `Cannot rename entity "${entity.name}" to "${newName}" - name already in use by another entity in this world`,
      );
    }
    this.entitiesByName.delete(entity.name);
    this.entitiesByName.set(newName, entity);
  }

  /**
   * Find an entity anywhere in the world by name - an O(1) lookup backed by an index kept in sync
   * by `addEntity`/`removeEntity`/`renameEntity`, covering every entity ever added via `addEntity`
   * (nested entities included - `addChildren`/`onSpawned` cascade into it too); to search inside
   * one particular entity's own subtree instead, use `IEntity.getChildEntityByName`. Names are
   * enforced unique world-wide - `addEntity` and the `name` setter both throw on a collision - so
   * there is never more than one match to choose between.
   * @param name - The entity's `name`
   * @returns The entity with that name
   * @throws if no entity in the world has that name
   */
  public getEntityByName<T extends IEntity = IEntity>(name: string): T {
    const found = this.entitiesByName.get(name);
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
   * bug to notice than an explicit console warning naming every renderer present.
   */
  private autoBoundListener: IPositionable<D, R> | null = null;

  private maybeBindAudioListener(entity: IEntity): void {
    if (!this.audioScene || !(entity instanceof IRendererEntity)) {
      return;
    }
    // `activeListener` no longer being the object we last auto-bound means the app has since
    // called `setActiveListener` itself (explicitly choosing one, or explicitly clearing it back
    // to null isn't possible to distinguish from "never set" here, but that's fine - see below).
    // Once that's happened, it's app-owned from then on: never touched or warned about again, no
    // matter how many renderers show up or get swapped out afterwards. Comparing against the
    // actual last-bound reference (rather than a plain "did we ever auto-bind" flag) is what lets
    // this survive a renderer being removed and a different one added later - a stale flag would
    // otherwise re-arm the auto-bind guard and clobber the app's explicit choice on that swap.
    if (this.audioScene.activeListener !== null && this.audioScene.activeListener !== this.autoBoundListener) {
      return;
    }
    const renderers = this.renderers;
    if (renderers.length === 1) {
      this.autoBoundListener = renderers[0].camera;
      this.audioScene.setActiveListener(this.autoBoundListener);
    } else if (renderers.length > 1) {
      warnOnce(
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
