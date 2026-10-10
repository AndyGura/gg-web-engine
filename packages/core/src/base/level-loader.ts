import { Observable, Subscription } from 'rxjs';
import { GgWorld, GgWorldTypeDocRepo } from './gg-world';
import { GroupEntity } from './entities/group.entity';
import { IEntity, TickOrder } from './entities/i-entity';
import { Blueprint, BlueprintJson, BlueprintNodeFactory } from './blueprint/blueprint';
import { RemoveEntityBlueprintNode } from './blueprint/nodes/remove-entity.node';
import { PlaySoundBlueprintNode } from './blueprint/nodes/play-sound.node';
import { warnOnce } from './logging';
import { IPositionable } from './interfaces/i-positionable';
import { isSerializableEntity } from './interfaces/i-serializable-entity';
import { AssetCache, AssetScope } from './assets/asset-cache';
import { AssetRef } from './assets/asset-ref';
import { fetchWithProgress } from './assets/fetch-with-progress';
import { AssetProgress, linkSignals, LoadProgressGroup, LoadTaskOptions, throwIfAborted } from './assets/load-progress';

/**
 * A function that turns per-entity JSON settings into a spawned `IEntity` (e.g. a primitive body,
 * a trigger, a camera). Registered against a class alias via {@link LevelLoader.registerClass}.
 * May be `async`/return a `Promise` (e.g. the built-in `"Glb"` 3D class, which fetches a model) -
 * {@link LevelLoader.loadLevel} awaits every generator before moving to the next entity. A
 * generator that returns anything other than an `IEntity` (including `null`/`undefined`) has its
 * result discarded - see {@link LevelLoader.loadLevel}.
 * @template D - The position type
 * @template R - The rotation type
 * @template TypeDoc - The type document repository
 *
 * The third argument carries the progress callback, abort signal and asset scope of the load the
 * entity is built in. A generator that loads something itself passes it on to the `world.loader`
 * method it calls (`world.loader.loadGgGlb(path, { ...load })`), so that load is counted in the
 * level's progress, stops when the level load is aborted, and is freed with the level.
 * @template Settings - The settings object type
 * @template W - The world type
 */
export type EntityGenerator<
  D,
  R,
  TypeDoc extends GgWorldTypeDocRepo<D, R>,
  Settings = any,
  W = GgWorld<D, R, TypeDoc>,
> = (world: W, settings: Settings, load: LoadTaskOptions) => any;

/**
 * Options of {@link LevelLoader.registerClass}.
 */
export type EntityClassOptions<Settings = any> = {
  /** The concrete entity constructor the generator produces - see `registerClass`. */
  entityClass?: Function;
  /**
   * The assets an entity of this class loads, from its settings. `loadLevel` collects them from
   * every entity of a level and loads them together, in parallel, before building anything, so
   * the level's progress knows its total from the start. Without it the class still works: what
   * its generator loads is counted from the moment the generator asks for it.
   */
  assets?: (settings: Settings) => AssetRef[];
};

/**
 * A level/scene, serializable as a single JSON document (e.g. to be hosted as a static file and
 * loaded via {@link LevelLoader.loadLevelFromUrl}).
 */
export interface LevelJson {
  /**
   * Entities in the level
   */
  entities: EntityJson[];

  /**
   * Blueprint graphs available to this level's entities, keyed by name - referenced from an
   * `EntityJson.events` entry to run a blueprint whenever the named observable on that entity
   * fires. See {@link BlueprintJson} and the `gg-engine-level-json` skill's "Blueprints" section.
   */
  blueprints?: Record<string, BlueprintJson>;
}

/**
 * JSON description of a single entity in a level. `position`/`rotation` are left untyped here
 * since their shape depends on the dimensionality (`Point2`/`number` for 2D, `Point3`/`Point4`
 * for 3D) of whichever `LevelLoader` subclass parses this JSON.
 */
export interface EntityJson {
  /**
   * Class alias for the entity, matching a class registered via `registerClass`. Built-in
   * primitive shapes (box/sphere/square/circle/...) all share the single `"Primitive"` alias and
   * are distinguished by `shape` instead of by a per-shape class - e.g. `{ class: "Primitive",
   * shape: "BOX" }` rather than `{ class: "BOX" }`. Apps register their own aliases (e.g.
   * `"ShapeSpawner"`) the same way the dimensionality-specific `LevelLoader` subclasses register
   * their built-ins, via `registerClass`.
   */
  class: string;

  /**
   * Shape identifier for the built-in `"Primitive"` entity class (e.g. `"Box"`, `"Circle"`) - see
   * the dimensionality-specific `LevelLoader` subclass (`Gg2dLevelLoader`/`Gg3dLevelLoader`) for
   * the supported values. Ignored for any other `class`.
   */
  shape?: string;

  /**
   * Position of the entity
   */
  position?: any;

  /**
   * Rotation of the entity
   */
  rotation?: any;

  /**
   * Name of the entity. `loadLevel` sets the generator's returned `IEntity`'s `.name` to this
   * (overriding whatever default the generator gave it), so it can be found afterwards with
   * `GgWorld.getEntityByName`/`IEntity.getChildEntityByName`. Moot if the generator doesn't return
   * an `IEntity` - that result is discarded (with a console warning) before naming is applied.
   * Optional - an entity with no explicit `name` here instead gets one derived from the level's own
   * `levelName` and this entity's position in `entities`, deterministic across every peer loading
   * the same document under the same `levelName` - see `LevelLoader.loadLevel`.
   */
  name?: string;

  /**
   * Configuration for the entity, passed to its generator alongside position/rotation/name
   */
  config?: any;

  /**
   * Maps an observable property name on this entity's generated `IEntity` (e.g. `Trigger3dEntity`'s
   * `"onEntityEntered"`) to what should run whenever that observable fires - see
   * {@link EntityEventBinding}. `createEntity` (and therefore `loadLevel`, which builds every entity
   * through it) subscribes to the observable and triggers a fresh `Blueprint` instance (via its
   * `"in"` entry point) with whatever value it emits, each time it fires, and parents the binding
   * directly under this entity - see `LevelLoader.createEntity` and the `gg-engine-level-json`
   * skill's "Blueprints" section. Silently ignored (with a console warning) if the binding can't be
   * resolved to a blueprint, or the named property isn't an `Observable`.
   */
  events?: Record<string, EntityEventBinding>;
}

/**
 * What an `EntityJson.events` entry runs. Either:
 * - a plain `string` - first tried as a key into the level's top-level `blueprints` map (a named,
 *   possibly multi-node graph); if not found there, tried as a blueprint node type alias
 *   registered via `registerBlueprintNode` (e.g. the built-in `"RemoveEntity"`) instead, with no
 *   settings - shorthand for the single-node form below with `settings` omitted.
 * - `{ type, settings? }` - a single built-in/registered blueprint node used directly as the
 *   handler, with inline `settings`, no `blueprints` entry needed at all - e.g.
 *   `{ "type": "RemoveEntity", "settings": { "dispose": true } }`. Only node types registered with
 *   a default input pin (every built-in one is - see `registerBlueprintNode`) support this form;
 *   others require a full graph declared in `blueprints` instead, addressing the desired input pin
 *   explicitly via `inputs`.
 */
export type EntityEventBinding = string | { type: string; settings?: Record<string, any> };

/**
 * What {@link LevelLoader.createEntity}/{@link LevelLoader.loadLevel} remember about how one
 * entity was built, so {@link LevelLoader.serializeEntity} can echo it back later without needing
 * to reverse-engineer it from the entity's own live physics/visual state (which, for most classes,
 * isn't even possible - e.g. nothing hands a `"Primitive"`'s original `shape`/`dimensions` back out
 * of its physics body). Kept in a `WeakMap` keyed by entity instance, so it costs nothing once an
 * entity is garbage-collected and needs no explicit cleanup on removal/disposal.
 */
interface EntitySpawnRecord {
  classAlias: string;
  shape?: string;
  config?: any;
  events?: Record<string, EntityEventBinding>;
}

/**
 * Customizes how {@link LevelLoader.serializeEntity} turns one entity back into an `EntityJson`,
 * for a class alias whose default serialization - either the entity's own
 * {@link ISerializableEntity.serializeSettings} if it implements that, or (if not) an echo of the
 * `shape`/`config` it was originally built from - isn't enough, in either case with `name`/
 * `position`/`rotation` read live off the entity. Registered via
 * {@link LevelLoader.registerSerializer}, paired with `registerClass` on the same `classAlias`.
 * Typically starts from `defaultJson` and layers extra/overridden fields onto its `config` (e.g. to
 * add something neither the entity class itself nor the spawn-time `config` capture) rather than
 * building an `EntityJson` from scratch. This is an escape hatch for the *rare* case that needs to
 * override a class's serialization from outside the class - prefer implementing
 * {@link ISerializableEntity} directly on the entity class itself when you own that class, so the
 * logic lives next to the state it describes instead of split across two files.
 * @param entity - The entity to serialize
 * @param defaultJson - What `serializeEntity` would emit without this override - `class`, `shape`/
 * `config` (from the entity's own `serializeSettings` if it implements `ISerializableEntity`,
 * otherwise the spawn-time echo), and live `name`/`position`/`rotation` (the latter two included
 * only if `entity` actually has them)
 * @returns The `EntityJson` to emit for this entity, or `undefined` to mark it not serializable
 * despite having a spawn record (logged as a warning by `serializeEntity`)
 */
export type EntitySerializer<D, R, TypeDoc extends GgWorldTypeDocRepo<D, R>> = (
  entity: IEntity<D, R, TypeDoc>,
  defaultJson: EntityJson,
) => EntityJson | undefined;

/**
 * Reconstructs an `EntityJson` by reading an entity's own *current* live state - not an echo of
 * whatever it happened to be constructed with - so it works for an entity regardless of how (or by
 * what code) it was actually built, and stays accurate no matter how much its state has drifted
 * since. Tried, in registration order, by {@link LevelLoader.serializeEntity} first, ahead of an
 * entity's own {@link ISerializableEntity.serializeSettings} and the spawn-record echo - see
 * {@link LevelLoader.registerLiveSerializer}. Reach for this (registered externally against the
 * loader) only for a class like `"Primitive"` that has no single entity class of its own to
 * implement `ISerializableEntity` on (it can produce a box, a sphere, ... all the same `Entity3d`);
 * prefer `ISerializableEntity` directly on the entity class for anything that does.
 *
 * Must return `undefined` (not throw) for any entity it doesn't recognize/can't fully reconstruct -
 * `serializeEntity` moves on to the next registered live serializer, then to the spawn-record echo,
 * treating `undefined` as "not my entity" rather than "this entity failed to serialize". The
 * built-in `"Primitive"`/`"Trigger"` live serializers (registered by `Gg2dLevelLoader`/
 * `Gg3dLevelLoader`) are the reference implementation: they match on the entity's own concrete
 * class (`entity.constructor === Entity3d`, not `instanceof`, so a richer subclass like
 * `Grabbable3dEntity` - which needs its own dedicated serializer to round-trip correctly, not yet
 * provided - doesn't get silently mistaken for a plain primitive), then read shape (`objectBody
 * .debugBodySettings.shape`), body options (`objectBody.bodyOptions`), and velocity
 * (`objectBody.linearVelocity`/`angularVelocity`) straight off the live physics body.
 * @param entity - The entity to serialize
 * @returns The entity's `EntityJson`, or `undefined` if this serializer doesn't apply to it
 */
export type LiveEntitySerializer<D, R, TypeDoc extends GgWorldTypeDocRepo<D, R>> = (
  entity: IEntity<D, R, TypeDoc>,
) => EntityJson | undefined;

/**
 * Base class for level loaders: parses a {@link LevelJson} document into world entities by
 * dispatching each `EntityJson.class` to a generator function registered with {@link registerClass}.
 *
 * A generator is required to return an `IEntity`. Every `IEntity` a generator produces is parented
 * under one {@link GroupEntity} per `loadLevel`/`loadLevelFromUrl` call (added to the world
 * immediately, and handed back once loading completes) - so a whole level can be torn down in one
 * shot with `world.removeEntity(level, true)`, which cascades removal/disposal to every child, and
 * any named entity can be found afterwards with `level.getChildEntityByName(name)`. If a generator
 * returns anything other than an `IEntity` (including `null`/`undefined`), `loadLevel` logs a
 * `console.warn` and skips that entity - it's never parented, named, or tracked.
 * @template D - The position type
 * @template R - The rotation type
 * @template TypeDoc - The type document repository
 */
export abstract class LevelLoader<D, R, TypeDoc extends GgWorldTypeDocRepo<D, R>> {
  /**
   * Map of class aliases to generator functions
   */
  protected generators: Map<string, EntityGenerator<D, R, TypeDoc, any, any>> = new Map();

  /**
   * Map of blueprint node type aliases to node factory functions - see {@link registerBlueprintNode}.
   */
  protected blueprintNodes: Map<string, BlueprintNodeFactory<D, R, TypeDoc>> = new Map();

  /**
   * Map of blueprint node type aliases to their default input pin name, for node types registered
   * with one - see {@link registerBlueprintNode}.
   */
  protected blueprintNodeDefaultInputs: Map<string, string> = new Map();

  /**
   * Map of class aliases to custom serializers - see {@link registerSerializer}.
   */
  protected serializers: Map<string, EntitySerializer<D, R, TypeDoc>> = new Map();

  /**
   * Live, state-reading serializers, tried in registration order before the spawn-record echo -
   * see {@link registerLiveSerializer}.
   */
  protected liveSerializers: LiveEntitySerializer<D, R, TypeDoc>[] = [];

  /**
   * What {@link createEntity} built each entity from, so {@link serializeEntity} can echo it back -
   * see {@link EntitySpawnRecord}.
   */
  private readonly spawnRecords = new WeakMap<IEntity<D, R, TypeDoc>, EntitySpawnRecord>();

  /**
   * Class alias each entity constructor is registered under - the optional third argument to
   * {@link registerClass}. Lets {@link serializeEntity} resolve a self-serializing entity's `class`
   * alias (see {@link ISerializableEntity}) even when that entity has no spawn record - i.e. wasn't
   * built via {@link createEntity}/{@link loadLevel} at all, so there's nothing else to resolve it
   * from.
   */
  private readonly classAliasesByCtor = new Map<Function, string>();

  /** `assets` hooks by class alias - see {@link EntityClassOptions.assets}. */
  private readonly classAssets = new Map<string, (settings: any) => AssetRef[]>();

  /** `assets` hooks by blueprint node type alias - see {@link registerBlueprintNode}. */
  private readonly blueprintNodeAssets = new Map<string, (settings: Record<string, any>) => AssetRef[]>();

  /**
   * This world's asset cache: every asset loaded through this loader is kept here, shared by
   * concurrent and repeated loads, and freed when the last {@link AssetScope} holding it is
   * released (or with the world).
   */
  public readonly assetCache: AssetCache = new AssetCache();

  /**
   * Constructor
   * @param world - The world instance
   */
  constructor(protected readonly world: GgWorld<D, R, TypeDoc>) {
    this.registerBlueprintNode(
      'RemoveEntity',
      (w, settings) => new RemoveEntityBlueprintNode<D, R, TypeDoc>(w, settings),
      'entity',
    );
    this.registerBlueprintNode(
      'PlaySound',
      (w, settings) => new PlaySoundBlueprintNode<D, R, TypeDoc>(w, settings),
      'trigger',
      settings =>
        [settings.clip, ...(settings.impactClips ?? []).map((tier: any) => tier?.clip)]
          .filter(clip => typeof clip === 'string' && !!clip)
          .map(url => ({ kind: 'clip', url })),
    );
  }

  /**
   * Creates a holder for loaded assets: pass it as `scope` to any load, and call `release()` once
   * what was loaded is no longer needed. `loadLevel` does this by itself for a level.
   */
  public createAssetScope(): AssetScope {
    return this.assetCache.createScope();
  }

  /** Frees every cached asset. Called by the world when it is disposed. */
  public dispose(): void {
    this.assetCache.dispose();
  }

  /**
   * Loads an audio clip for `audioScene.factory.createSource`.
   * @throws if the world has no audio scene
   */
  public async loadClip(url: string, options: LoadTaskOptions = {}): Promise<TypeDoc['aTypeDoc']['clip']> {
    const audioScene = this.world.audioScene;
    if (!audioScene) {
      throw new Error('Cannot load an audio clip into a world without an audio scene');
    }
    return this.acquireAsset(`clip:${url}`, url, options, async (item, signal) => {
      if (!audioScene.factory.decodeClip) {
        return { value: await audioScene.factory.loadClip(url) };
      }
      const data = await fetchWithProgress(url, item.file(), signal);
      return { value: await audioScene.factory.decodeClip(data) };
    });
  }

  /**
   * Loads assets ahead of use, in parallel, under one progress. A later load of the same asset
   * through this loader finds it cached. An asset kind the world has no scene for (a clip without
   * an audio scene, a model without a visual scene) is skipped.
   */
  public async preload(refs: AssetRef[], options: LoadTaskOptions = {}): Promise<void> {
    // the first failure cancels the rest
    const cancel = new AbortController();
    const linked = linkSignals(options.signal, cancel.signal);
    const group = new LoadProgressGroup({ ...options, signal: linked.signal });
    let failure: { error: unknown } | null = null;
    await Promise.allSettled(
      refs.map(async ref => {
        const slot = group.sub();
        try {
          await this.preloadAsset(ref, slot);
          group.complete(slot);
        } catch (error) {
          failure ??= { error };
          cancel.abort();
        }
      }),
    );
    linked.release();
    throwIfAborted(options.signal);
    if (failure) {
      throw (failure as { error: unknown }).error;
    }
    group.finish();
  }

  /** Loads one {@link AssetRef}. Subclasses add the kinds of their dimension. */
  protected async preloadAsset(ref: AssetRef, options: LoadTaskOptions): Promise<void> {
    if (ref.kind === 'clip') {
      if (this.world.audioScene) {
        await this.loadClip(ref.url, options);
      }
      return;
    }
    throw new Error(`This loader cannot preload an asset of kind "${ref.kind}"`);
  }

  /**
   * Fetches `url` for a cached asset whose key holds more than the url (a model loaded with
   * different options, a texture with different filtering): loads of the same file running at the
   * same time share one download. The bytes are not kept once every such load has them.
   */
  protected async fetchShared(url: string, item: AssetProgress, signal: AbortSignal): Promise<ArrayBuffer> {
    const reading = this.createAssetScope();
    const report = item.file();
    let downloadedHere = false;
    try {
      const data = await this.assetCache.acquire(
        `data:${url}`,
        reading,
        async loadSignal => {
          downloadedHere = true;
          return { value: await fetchWithProgress(url, report, loadSignal) };
        },
        signal,
      );
      if (!downloadedHere) {
        // someone else's download: this load's file is complete all at once
        report(data.byteLength, data.byteLength, true);
      }
      return data;
    } finally {
      reading.release();
    }
  }

  /**
   * The cache access shared by every loader method: returns the asset under `key`, running `load`
   * (with a progress reporter for it) when it is not cached, and reports the asset complete. `load`
   * fetches with the signal it is given, not `options.signal`: that one also aborts when the world
   * is disposed.
   */
  protected async acquireAsset<T>(
    key: string,
    url: string,
    options: LoadTaskOptions,
    load: (item: AssetProgress, signal: AbortSignal) => Promise<{ value: T; dispose?: () => void }>,
  ): Promise<T> {
    let item: AssetProgress | undefined;
    const value = await this.assetCache.acquire(
      key,
      options.scope,
      signal => {
        item = new AssetProgress(url, options.onProgress);
        return load(item, signal);
      },
      options.signal,
    );
    throwIfAborted(options.signal);
    if (item) {
      item.done();
    } else {
      // served from the cache: complete, and nothing new to count
      options.onProgress?.({
        fraction: 1,
        loadedItems: 0,
        totalItems: 0,
        bytesLoaded: 0,
        bytesTotal: 0,
        current: url,
      });
    }
    return value;
  }

  /**
   * Register a generator function for a class alias
   * @param classAlias - The class alias
   * @param generator - The generator function
   * @param entityClass - The concrete entity constructor `generator` produces, if it always
   * produces the same one. Optional - only needed to let {@link serializeEntity} resolve `class`
   * for an instance of this class that's self-serializing (see {@link ISerializableEntity}) but
   * wasn't itself built via `createEntity`/`loadLevel` (so has no spawn record to fall back on),
   * e.g. one constructed directly with `new SomeEntity(...)`. Skip it for a generator whose result
   * type varies (most built-ins - `"Primitive"` can produce several different shapes, and several
   * different classes all produce a plain `GroupEntity`), or whose class doesn't self-serialize;
   * neither loses anything by omitting it, since a spawn record already resolves `class` for any
   * instance actually built through this loader. An {@link EntityClassOptions} object in its place
   * carries it as `entityClass`, next to the class's `assets` hook.
   *
   * @example
   * ```ts
   * import { Gg3dWorld, IEntity, LevelJson, Point3, TickOrder } from '@gg-web-engine/core';
   *
   * class Spinner extends IEntity {
   *   static readonly entityTypeName: string = 'Spinner';
   *   public readonly tickOrder = TickOrder.CONTROLLERS;
   * }
   *
   * // the generator gets the world and the entity's JSON `config`, plus its `name`/`position`/
   * // `rotation`/`shape` when the JSON sets them
   * world.loader.registerClass('Spinner', (w: Gg3dWorld, settings: { position?: Point3; speed?: number }) => {
   *   const spinner = new Spinner();
   *   // ...build it from settings.position / settings.speed
   *   return spinner; // must return an IEntity; loadLevel adds it to the world
   * });
   *
   * const level: LevelJson = {
   *   entities: [{ class: 'Spinner', name: 'Fan', position: { x: 0, y: 0, z: 3 }, config: { speed: 2 } }],
   * };
   * await world.loader.loadLevel(level, 'Room');
   * ```
   */
  public registerClass<Settings, W = any>(
    classAlias: string,
    generator: EntityGenerator<D, R, TypeDoc, Settings, W>,
    entityClass?: Function | EntityClassOptions<Settings>,
  ): void {
    const options: EntityClassOptions<Settings> =
      typeof entityClass === 'function' ? { entityClass } : (entityClass ?? {});
    this.generators.set(classAlias, generator);
    if (options.entityClass) {
      this.classAliasesByCtor.set(options.entityClass, classAlias);
    }
    if (options.assets) {
      this.classAssets.set(classAlias, options.assets);
    } else {
      this.classAssets.delete(classAlias);
    }
  }

  /**
   * Register a {@link BlueprintNode} factory for a node type alias, so a `BlueprintJson`'s
   * `nodes` can reference it by `type` (e.g. the built-in `"RemoveEntity"`, registered by every
   * `LevelLoader` out of the box). Same pattern as {@link registerClass}, one level down (node
   * types within a blueprint graph, rather than entity classes within a level).
   * @param typeAlias - The node type alias
   * @param factory - Builds a node instance from its baked-in settings
   * @param defaultInputPin - This node type's sole "trigger me" input pin name, if it has one
   * canonical one (e.g. `"RemoveEntity"`'s `"entity"`). Enables the node type to be used directly
   * as an `EntityJson.events` binding (`{ "eventName": "TypeAlias" }` or
   * `{ "eventName": { "type": "TypeAlias", "settings": {...} } }`) without declaring a full
   * `BlueprintJson` graph in `blueprints` - see {@link EntityEventBinding}. Omit for a node type
   * with zero or multiple input pins, or one with no single obviously-correct default; it remains
   * usable from a full graph either way.
   * @param assets - The assets a node of this type loads, from its settings - the node-level
   * counterpart of {@link EntityClassOptions.assets}, collected by `loadLevel` the same way
   */
  public registerBlueprintNode(
    typeAlias: string,
    factory: BlueprintNodeFactory<D, R, TypeDoc>,
    defaultInputPin?: string,
    assets?: (settings: Record<string, any>) => AssetRef[],
  ): void {
    this.blueprintNodes.set(typeAlias, factory);
    if (assets) {
      this.blueprintNodeAssets.set(typeAlias, assets);
    } else {
      this.blueprintNodeAssets.delete(typeAlias);
    }
    if (defaultInputPin !== undefined) {
      this.blueprintNodeDefaultInputs.set(typeAlias, defaultInputPin);
    } else {
      this.blueprintNodeDefaultInputs.delete(typeAlias);
    }
  }

  /**
   * Register a custom {@link EntitySerializer} for a class alias, overriding
   * {@link serializeEntity}'s default (spawn-config echo) serialization for entities built under
   * that alias. Not required for a class to be serializable at all - any class built via
   * `createEntity`/`loadLevel` already gets the default behavior for free; this is only for a class
   * whose default isn't enough (e.g. it needs to capture runtime-mutated state into `config`).
   * @param classAlias - The class alias, matching a `registerClass` call
   * @param serializer - The custom serializer
   */
  public registerSerializer(classAlias: string, serializer: EntitySerializer<D, R, TypeDoc>): void {
    this.serializers.set(classAlias, serializer);
  }

  /**
   * Register a {@link LiveEntitySerializer}, tried (in registration order, before every other
   * registered one) by {@link serializeEntity} ahead of the spawn-record echo. Use this instead of
   * (or, for a class registered via `registerLiveSerializer` for its primary shape but wanting the
   * echo as a secondary fallback, alongside) {@link registerSerializer} whenever an entity's state
   * can be read back off its live physics/visual components well enough to reconstruct an
   * equivalent `EntityJson` without needing to have gone through `createEntity`/`loadLevel` at all -
   * see that type's own doc for the `"Primitive"`/`"Trigger"` reference implementation.
   * @param serializer - The live serializer
   */
  public registerLiveSerializer(serializer: LiveEntitySerializer<D, R, TypeDoc>): void {
    this.liveSerializers.push(serializer);
  }

  /**
   * Build a single entity from an `EntityJson`-shaped descriptor, dispatching `entityJson.class` to
   * whichever generator is registered for it (see {@link registerClass}) - the single-entity
   * counterpart of {@link loadLevel}, for a runtime spawn that doesn't come from (and shouldn't be
   * forced into) a whole level document, e.g. a networked "spawn this entity" message carrying one
   * `EntityJson`. Unlike `loadLevel`, the returned entity is **not** parented under any group, and
   * `entity.name` is left untouched unless `entityJson.name` is explicitly given or `defaultName`
   * is passed (no level-scoped/index-derived fallback name of its own, since there's no level or
   * index here) - the caller is responsible for both adding it to the world
   * (`world.addEntity(entity)`, safe even if the generator already self-added it - see
   * `loadLevel`'s own note on this) and, if desired, parenting it under something
   * (`parent.addChildren(entity)`).
   *
   * Whichever name is resolved (`entityJson.name`, else `defaultName`) is also handed to the
   * generator as `settings.name` *before* the entity is built, so a generator that needs to derive
   * something from the entity's final name (e.g. the built-in `"Glb"` class scoping the names of
   * every sub-entity a model expands into under it) can - not just read it back afterwards.
   *
   * The entity's `class`/`shape`/`config` are remembered (in a `WeakMap`, keyed by the entity
   * itself) so {@link serializeEntity} can later reconstruct an equivalent `EntityJson` for it -
   * this is what makes an entity built this way (or via `loadLevel`) serializable at all.
   *
   * If `entityJson.events` is present, each binding is resolved via the same mechanism `loadLevel`
   * uses (see {@link bindEvent} and the `gg-engine-level-json` skill's "Blueprints" section) and the
   * resulting binding entity is parented directly under the just-built entity
   * (`entity.addChildren(bindingEntity)`) - not under any group, since `createEntity` doesn't have
   * one. This means the binding's subscription/blueprint is torn down whenever the entity itself is
   * (`entity.dispose()`, or removal with `dispose: true` once added to a world), with nothing extra
   * for the caller to clean up. `loadLevel` relies on this same behavior (see below) rather than
   * parenting bindings under the level's group itself.
   * @param entityJson - The entity descriptor
   * @param defaultName - Name to give the entity when `entityJson.name` is absent; `loadLevel`
   * passes its level-derived fallback here
   * @param blueprints - Named blueprint graphs `entityJson.events` bindings may reference by name;
   * `loadLevel` passes the level's own top-level `blueprints` map here
   * @param load - Progress callback, abort signal and asset scope for whatever the entity loads.
   * Without a `scope`, the entity gets one of its own: the assets it loaded are freed when it is
   * disposed (unless something else holds them too).
   * @returns The built entity, or `undefined` (logged via `console.warn`) if `entityJson.class` has
   * no registered generator, or that generator didn't return an `IEntity`
   */
  public async createEntity(
    entityJson: EntityJson,
    defaultName?: string,
    blueprints?: Record<string, BlueprintJson>,
    load: LoadTaskOptions = {},
  ): Promise<IEntity<D, R, TypeDoc> | undefined> {
    const { class: classAlias, shape, config, events } = entityJson;
    const name = entityJson.name !== undefined ? entityJson.name : defaultName;
    const generator = this.generators.get(classAlias);
    if (!generator) {
      warnOnce(`No generator registered for class alias "${classAlias}"`);
      return undefined;
    }

    const settings = this.entitySettings(entityJson, name);
    const ownScope = load.scope ? null : this.createAssetScope();
    let entity: unknown;
    try {
      entity = await generator(this.world, settings, { ...load, scope: load.scope ?? ownScope! });
    } catch (e) {
      ownScope?.release();
      throw e;
    }
    if (!(entity instanceof IEntity)) {
      ownScope?.release();
      warnOnce(`Generator for class alias "${classAlias}" did not return an IEntity - skipping`);
      return undefined;
    }
    if (ownScope) {
      entity.disposed$.subscribe(() => ownScope.release());
    }
    if (name !== undefined) {
      entity.name = name;
    }
    this.spawnRecords.set(entity, { classAlias, shape, config, ...(events ? { events } : {}) });

    if (events) {
      for (const [eventName, eventBinding] of Object.entries(events)) {
        const bindingEntity = this.bindEvent(entity, eventName, eventBinding, blueprints);
        if (bindingEntity) {
          entity.addChildren(bindingEntity);
        }
      }
    }

    return entity;
  }

  /** The settings object a generator (and an `assets` hook) receives for `entityJson`. */
  private entitySettings(entityJson: EntityJson, name: string | undefined): Record<string, any> {
    const { shape, position, rotation, config } = entityJson;
    return {
      ...(config ?? {}),
      ...(shape !== undefined ? { shape } : {}),
      ...(position !== undefined ? { position } : {}),
      ...(rotation !== undefined ? { rotation } : {}),
      ...(name !== undefined ? { name } : {}),
    };
  }

  /**
   * Every asset the entities and blueprints of `levelJson` declare through their `assets` hooks
   * (see {@link EntityClassOptions.assets}, {@link registerBlueprintNode}). A hook that throws on
   * settings its generator would reject anyway is skipped, leaving the error to the generator.
   */
  public collectLevelAssets(levelJson: LevelJson, levelName: string = ''): AssetRef[] {
    const refs: AssetRef[] = [];
    const collect = (hook: ((settings: any) => AssetRef[]) | undefined, settings: any) => {
      if (!hook) {
        return;
      }
      try {
        refs.push(...hook(settings));
      } catch {
        // the generator reports what is wrong with these settings
      }
    };
    const collectNode = (type: string, settings: Record<string, any> | undefined) =>
      collect(this.blueprintNodeAssets.get(type), settings ?? {});
    levelJson.entities.forEach((entityJson, index) => {
      const name = entityJson.name ?? `${levelName}__${entityJson.class}_${index}`;
      collect(this.classAssets.get(entityJson.class), this.entitySettings(entityJson, name));
      for (const binding of Object.values(entityJson.events ?? {})) {
        if (typeof binding === 'object') {
          collectNode(binding.type, binding.settings);
        } else if (!levelJson.blueprints?.[binding]) {
          collectNode(binding, undefined);
        }
      }
    });
    for (const blueprint of Object.values(levelJson.blueprints ?? {})) {
      for (const node of blueprint.nodes ?? []) {
        collectNode(node.type, node.settings);
      }
    }
    return refs;
  }

  /**
   * Turn a live entity back into the `EntityJson`-shaped descriptor that could reproduce it via
   * {@link createEntity}/{@link loadLevel} - the inverse of entity construction. Tries three
   * mechanisms, in order:
   *
   * 1. Every registered {@link LiveEntitySerializer}, in registration order (see
   *    {@link registerLiveSerializer}) - these read the entity's own current physics/visual state
   *    directly, so they work regardless of how the entity was actually built. This is the
   *    mechanism the built-in `"Primitive"`/`"Trigger"` classes use, since there's no single entity
   *    class those two alone would own (`"Primitive"` alone covers every shape).
   * 2. The entity's own {@link ISerializableEntity.serializeSettings}, if it implements that
   *    interface - the class-owned counterpart of (1), for a class (built-in, like `"GgCar"`, or
   *    app-defined) that *does* have one entity class to own the logic. Its `class` alias is
   *    resolved from the entity's spawn record if it has one (see (3)), or otherwise from the
   *    constructor->alias mapping an optional third {@link registerClass} argument sets up - so this
   *    still works for an entity built directly (`new SomeEntity(...)`), not only through this
   *    loader, as long as its class was registered with that third argument.
   * 3. Spawn-record echo - works only for an entity that was itself built by this loader
   *    (`createEntity`, and therefore `loadLevel` too, but not tier (2), which already claims any
   *    entity that both has a spawn record *and* self-serializes): remembers the `class`/`shape`/
   *    `config` it was built from and echoes them straight back, with `name`/`position`/`rotation`
   *    still read live off the entity (not its spawn-time values). This is the only option left for
   *    a class with no live-state equivalent and no self-serialization of its own (a `"Sound"`'s
   *    clip URL, a `"MapGraph"`'s graph structure).
   *
   * Tiers (2) and (3) also echo the `events` bindings an entity was built with (by `createEntity`), so
   * re-creating an entity from its own serialization - e.g. on another peer - rebinds them (against
   * whatever `blueprints` map that `createEntity` call is given).
   *
   * An entity matched by none of the three - built some other way with no live/self-serializer
   * applicable, or a child an entity class adds to itself (a `"Player"`'s
   * `CharacterAnimationController`) - has nothing to reconstruct it from; this logs a warning and
   * returns `undefined` rather than guessing. {@link registerSerializer} (layered onto whichever of
   * tiers (2)/(3) produced the entity's `class`/`shape`/`config`, if any did) is still available for
   * a class that needs to add/override fields from outside the entity class itself.
   * @param entity - The entity to serialize
   * @returns The entity's `EntityJson` descriptor, or `undefined` if nothing could reconstruct it
   */
  public serializeEntity(entity: IEntity<D, R, TypeDoc>): EntityJson | undefined {
    for (const liveSerializer of this.liveSerializers) {
      const json = liveSerializer(entity);
      if (json) {
        return json;
      }
    }

    const record = this.spawnRecords.get(entity);

    if (isSerializableEntity(entity)) {
      const classAlias = record?.classAlias ?? this.classAliasesByCtor.get(entity.constructor);
      if (classAlias) {
        const { shape, config } = entity.serializeSettings();
        const json = this.buildEntityJson(classAlias, entity, shape, config, record?.events);
        const serializer = this.serializers.get(classAlias);
        return serializer ? serializer(entity, json) : json;
      }
    }

    if (!record) {
      warnOnce(
        `Cannot serialize entity "${entity.name}" - no registered live/self-serializer recognizes it, and it has ` +
          `no spawn record (wasn't built via createEntity/loadLevel) to fall back to`,
      );
      return undefined;
    }

    const json = this.buildEntityJson(record.classAlias, entity, record.shape, record.config, record.events);
    const serializer = this.serializers.get(record.classAlias);
    return serializer ? serializer(entity, json) : json;
  }

  /**
   * Assembles an `EntityJson` from a resolved `class` alias, optional `shape`/`config`, and this
   * entity's own live `name`/`position`/`rotation` (the latter two included only if `entity`
   * actually implements `IPositionable`) - the common tail shared by {@link serializeEntity}'s
   * self-serialization and spawn-record-echo tiers.
   */
  private buildEntityJson(
    classAlias: string,
    entity: IEntity<D, R, TypeDoc>,
    shape: string | undefined,
    config: any,
    events?: Record<string, EntityEventBinding>,
  ): EntityJson {
    const json: EntityJson = { class: classAlias, name: entity.name };
    if (shape !== undefined) {
      json.shape = shape;
    }
    if (config !== undefined) {
      json.config = config;
    }
    if (events !== undefined) {
      json.events = events;
    }
    const positionable = entity as unknown as Partial<IPositionable<D, R>>;
    if (positionable.position !== undefined) {
      json.position = positionable.position;
    }
    if (positionable.rotation !== undefined) {
      json.rotation = positionable.rotation;
    }
    return json;
  }

  /**
   * Serialize every top-level child of a loaded level's group entity (as `loadLevel`/`createEntity`
   * returned it) back into a `LevelJson`'s `entities` array - the level-wide counterpart of
   * {@link serializeEntity}. A child with no spawn record is skipped silently rather than warned
   * about - unlike a direct `serializeEntity` call, having this kind of internal/non-`entities`-array
   * child under a level is expected, not a sign of misuse (a `BlueprintBindingEntity` an `events`
   * binding creates is itself parented under the entity it's bound to, not directly under the level -
   * see `createEntity` - but this skip still guards against any other non-spawn-recorded child a
   * level's group might end up with). Only `entities` is reconstructed: each entity echoes the
   * `events` bindings it was built with, but the level's top-level `blueprints` map isn't rebuilt -
   * keep the original `blueprints` alongside if those bindings reference named graphs.
   * @param level - A level's root group entity, as returned by `loadLevel`/`loadLevelFromUrl`
   * @returns The reconstructed level JSON (`entities` only - see above)
   *
   * @example
   * ```ts
   * const level = await world.loader.loadLevel(levelJson, 'Level');
   * // ...play: bodies move, cars change gear...
   * const saved = world.loader.serializeLevel(level); // a LevelJson of the current state
   * localStorage.setItem('save', JSON.stringify(saved));
   *
   * // restore: drop the live level, load the saved one under the same name
   * world.removeEntity(level, true);
   * await world.loader.loadLevel(JSON.parse(localStorage.getItem('save')!), 'Level');
   * ```
   */
  public serializeLevel(level: GroupEntity<D, R, TypeDoc>): LevelJson {
    const entities: EntityJson[] = [];
    for (const child of level.children) {
      if (!this.spawnRecords.has(child)) {
        continue;
      }
      const json = this.serializeEntity(child);
      if (json) {
        entities.push(json);
      }
    }
    return { entities };
  }

  /**
   * Load a level from an already-parsed JSON document. Every `IEntity` the level's entities
   * produce is parented under - and, on failure, torn down along with - the returned
   * {@link GroupEntity}, already added to the world under `levelName`.
   *
   * Every entity that doesn't specify its own `name` in `levelJson` gets one derived as
   * `` `${levelName}__${classAlias}_${indexInEntitiesArray}` `` instead of the usual
   * process-global `IEntity` auto-generated default - deterministic purely from `levelName` and
   * this document's own content, so two peers loading the same `levelJson` under the same
   * `levelName` always agree on every entity's name, regardless of load order, timing, or what
   * else either peer has spawned. `levelName` must therefore be both required and unique per
   * loaded *instance* (loading the same level twice - e.g. two copies of one room - needs two
   * distinct `levelName`s, the same way two `GroupEntity`s can't otherwise be told apart by name).
   * @param levelJson - The level JSON
   *
   * Loading runs in two steps under one progress: first every asset the level's entities and
   * blueprints declare (see {@link collectLevelAssets}) is loaded, in parallel; then the entities
   * are built in document order, finding those assets cached. What a generator loads beyond the
   * declared assets is added to the progress as it appears. The level holds its assets through an
   * {@link AssetScope} of its own (`options.scope` is not used), released when the returned group
   * entity is disposed - so removing a level frees whatever only it used.
   * @param levelName - Name for the returned group entity, and the scope entities in this level
   * fall back to naming themselves under when `levelJson` doesn't give them an explicit `name`
   * @param options - Progress callback and abort signal. An aborted load rejects with an
   * `AbortError` and leaves nothing of the level behind.
   * @returns The level's root group entity
   * @throws if `levelName`, or any name (explicit or derived) an entity ends up with, collides
   * with a name already in use elsewhere in the world
   *
   * @example
   * ```ts
   * import { LevelJson } from '@gg-web-engine/core';
   *
   * const levelJson: LevelJson = {
   *   entities: [
   *     {
   *       class: 'Primitive',
   *       shape: 'BOX',
   *       name: 'Floor',
   *       config: { dimensions: { x: 20, y: 20, z: 1 }, body: { bodyType: 'static' } },
   *     },
   *     // 3D is Z-up: this crate starts 5 m above the floor
   *     { class: 'Primitive', shape: 'BOX', name: 'Crate', position: { x: 0, y: 0, z: 5 }, config: { dimensions: { x: 1, y: 1, z: 1 } } },
   *   ],
   * };
   *
   * const level = await world.loader.loadLevel(levelJson, 'Level', { onProgress: p => console.log(p.fraction) });
   * const crate = level.getChildEntityByName('Crate');
   * // tear the whole level down (and free what only it loaded) in one call
   * world.removeEntity(level, true);
   * ```
   */
  public async loadLevel(
    levelJson: LevelJson,
    levelName: string,
    options: LoadTaskOptions = {},
  ): Promise<GroupEntity<D, R, TypeDoc>> {
    throwIfAborted(options.signal);
    const level = new GroupEntity<D, R, TypeDoc>();
    level.name = levelName;
    this.world.addEntity(level);
    const scope = this.createAssetScope();
    const group = new LoadProgressGroup({ ...options, scope });

    try {
      const preloadSlot = group.sub();
      // one slot per entity up front, so a finished preload does not read as a finished level
      const entitySlots = levelJson.entities.map(() => group.sub());
      await this.preload(this.collectLevelAssets(levelJson, levelName), preloadSlot);
      for (let index = 0; index < levelJson.entities.length; index++) {
        throwIfAborted(options.signal);
        const entityJson = levelJson.entities[index];
        const { class: classAlias } = entityJson;

        // createEntity resolves entityJson.events (if any) against levelJson.blueprints and parents
        // the resulting binding(s) under the entity itself - see its own doc.
        const entity = await this.createEntity(
          entityJson,
          `${levelName}__${classAlias}_${index}`,
          levelJson.blueprints,
          entitySlots[index],
        );
        group.complete(entitySlots[index]);
        if (!entity) {
          continue;
        }
        // addChildren reparents the entity under level regardless of whether a generator already
        // self-added it to the world (e.g. addPrimitiveRigidBody does) - safe either way.
        level.addChildren(entity);
      }
      // the last generator may have ignored the signal while it was awaiting something
      throwIfAborted(options.signal);
    } catch (e) {
      // Don't leave a partially-loaded level (and its already-spawned entities) behind if a
      // generator throws partway through, or the load is aborted - the caller never gets `level`
      // back to clean it up itself.
      this.world.removeEntity(level, true);
      scope.release();
      throw e;
    }
    level.disposed$.subscribe(() => scope.release());
    group.finish();

    return level;
  }

  /**
   * Resolve `eventBinding` (see {@link EntityEventBinding}) to a `BlueprintJson`, instantiate a
   * fresh `Blueprint` from it, and subscribe it to `entity[eventName]` so every value that
   * observable emits triggers the blueprint's `"in"` entry point. Wrapped in a
   * `BlueprintBindingEntity` so the subscription (and the blueprint's own node state) is torn down
   * automatically once that entity is disposed - `createEntity` parents the returned entity under
   * `entity` itself (`entity.addChildren(bindingEntity)`) for that reason, so the binding's lifetime
   * is tied to the entity it's bound to, not to whatever group (if any) that entity ends up under.
   * @param entity - The entity carrying the observable property
   * @param eventName - Name of the observable property on `entity`
   * @param eventBinding - What to run - a `blueprints` name, a bare node type alias, or `{ type,
   * settings? }`
   * @param blueprints - The level's top-level blueprint map, if any
   * @returns The binding entity to parent under `entity`, or `undefined` if `eventBinding` couldn't
   * be resolved or the named property isn't an `Observable` (both logged via `console.warn`)
   */
  private bindEvent(
    entity: IEntity<D, R, TypeDoc>,
    eventName: string,
    eventBinding: EntityEventBinding,
    blueprints: Record<string, BlueprintJson> | undefined,
  ): BlueprintBindingEntity<D, R, TypeDoc> | undefined {
    const blueprintJson = this.resolveEventBlueprint(eventName, eventBinding, blueprints);
    if (!blueprintJson) {
      return undefined;
    }
    const observable = (entity as any)[eventName];
    if (!observable || typeof observable.subscribe !== 'function') {
      warnOnce(`Entity has no observable property "${eventName}" to bind a blueprint to`);
      return undefined;
    }
    const blueprint = new Blueprint<D, R, TypeDoc>(this.world, blueprintJson, this.blueprintNodes);
    return new BlueprintBindingEntity<D, R, TypeDoc>(
      blueprint,
      observable as Observable<unknown>,
      this.world,
      entity,
      eventName,
    );
  }

  /**
   * Turn an `EntityEventBinding` into a `BlueprintJson` to run. An object form (`{ type,
   * settings? }`) always builds a single-node inline graph via {@link inlineNodeBlueprint}. A
   * string form is tried first as a key into `blueprints` (a named, possibly multi-node graph),
   * then - if not found there - as a bare node type alias, same as the object form with no
   * settings.
   * @param eventName - Name of the observable property being bound, for warning messages
   * @param eventBinding - The binding to resolve
   * @param blueprints - The level's top-level blueprint map, if any
   * @returns The resolved graph, or `undefined` (logged via `console.warn`) if it couldn't be
   */
  private resolveEventBlueprint(
    eventName: string,
    eventBinding: EntityEventBinding,
    blueprints: Record<string, BlueprintJson> | undefined,
  ): BlueprintJson | undefined {
    if (typeof eventBinding === 'object') {
      return this.inlineNodeBlueprint(eventName, eventBinding.type, eventBinding.settings);
    }
    const named = blueprints?.[eventBinding];
    if (named) {
      return named;
    }
    if (this.blueprintNodes.has(eventBinding)) {
      return this.inlineNodeBlueprint(eventName, eventBinding, undefined);
    }
    warnOnce(`No blueprint or blueprint node type named "${eventBinding}" found for event "${eventName}" - skipping`);
    return undefined;
  }

  /**
   * Build a single-node `BlueprintJson` wrapping one blueprint node type, wired so the node's
   * registered default input pin (see {@link registerBlueprintNode}) is reachable as `"in"` - what
   * powers the `EntityEventBinding` shorthand that skips declaring a `blueprints` entry entirely.
   * @param eventName - Name of the observable property being bound, for warning messages
   * @param nodeType - The blueprint node type alias
   * @param settings - Settings to bake into the node, if any
   * @returns The single-node graph, or `undefined` (logged via `console.warn`) if `nodeType` isn't
   * registered, or was registered without a default input pin
   */
  private inlineNodeBlueprint(
    eventName: string,
    nodeType: string,
    settings: Record<string, any> | undefined,
  ): BlueprintJson | undefined {
    if (!this.blueprintNodes.has(nodeType)) {
      warnOnce(`No blueprint node type registered for "${nodeType}" (event "${eventName}") - skipping`);
      return undefined;
    }
    const inputPin = this.blueprintNodeDefaultInputs.get(nodeType);
    if (!inputPin) {
      warnOnce(
        `Blueprint node type "${nodeType}" has no default input pin registered - event "${eventName}" must ` +
          `reference a full graph declared in "blueprints" instead, addressing the desired pin explicitly`,
      );
      return undefined;
    }
    return {
      nodes: [{ id: 'n1', type: nodeType, settings }],
      inputs: { in: { node: 'n1', pin: inputPin } },
    };
  }

  /**
   * Fetch a level JSON document hosted at `url` and load it, so a whole level/scene can be
   * shipped and consumed as a single static JSON file.
   * @param url - URL (or path) of the level JSON document
   * @param levelName - Name for the returned group entity, see {@link loadLevel}
   * @param options - See {@link loadLevel}; the level document itself is part of the progress
   * @returns The level's root group entity
   */
  public async loadLevelFromUrl(
    url: string,
    levelName: string,
    options: LoadTaskOptions = {},
  ): Promise<GroupEntity<D, R, TypeDoc>> {
    const group = new LoadProgressGroup(options);
    const documentOptions = group.sub();
    const levelOptions = group.sub();
    const item = new AssetProgress(url, documentOptions.onProgress);
    const signal = linkSignals(options.signal, this.assetCache.lifetimeSignal);
    let data: ArrayBuffer;
    try {
      data = await fetchWithProgress(url, item.file(), signal.signal);
    } finally {
      signal.release();
    }
    const levelJson: LevelJson = JSON.parse(new TextDecoder().decode(data));
    item.done();
    const level = await this.loadLevel(levelJson, levelName, levelOptions);
    group.finish();
    return level;
  }
}

/**
 * Plain do-nothing `IEntity` that owns one event-to-blueprint binding created by
 * `LevelLoader.bindEvent`: subscribes to the bound observable on construction, and unsubscribes
 * plus disposes the `Blueprint` on `dispose()`. `createEntity` parents it directly under the entity
 * it's bound to (not under any group), so disposing/removing (with `dispose: true`) that entity - on
 * its own, or as part of tearing down a whole level via `world.removeEntity(level, true)` - tears the
 * binding down right along with it; there is nothing else app code needs to do to clean it up.
 * Every emission is first checked against `GgWorld.eventAuthority` - a network layer uses that to
 * make a gameplay-consequential binding run on exactly one peer instead of on every peer.
 * @template D - The position type
 * @template R - The rotation type
 * @template TypeDoc - The type document repository
 */
class BlueprintBindingEntity<D, R, TypeDoc extends GgWorldTypeDocRepo<D, R>> extends IEntity<D, R, TypeDoc> {
  static readonly entityTypeName: string = 'BlueprintBindingEntity';
  public readonly tickOrder = TickOrder.CONTROLLERS;
  private readonly subscription: Subscription;

  constructor(
    private readonly blueprint: Blueprint<D, R, TypeDoc>,
    observable: Observable<unknown>,
    world: GgWorld<D, R, TypeDoc>,
    boundEntity: IEntity<D, R, TypeDoc>,
    eventName: string,
  ) {
    super();
    this.subscription = observable.subscribe(value => {
      if (world.eventAuthority(boundEntity, eventName, value)) {
        this.blueprint.trigger('in', value);
      }
    });
  }

  public override dispose(): void {
    this.subscription.unsubscribe();
    this.blueprint.dispose();
    super.dispose();
  }
}
