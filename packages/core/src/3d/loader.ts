import { Gg3dWorld, Gg3dWorldTypeDocRepo } from './gg-3d-world';
import { GG_META_SUPPORTED_FORMAT_VERSION, GgMeta } from './models/gg-meta';
import { Entity3d } from './entities/entity-3d';
import {
  AssetProgress,
  AssetRef,
  fetchWithProgress,
  GroupEntity,
  linkSignals,
  LoadProgressGroup,
  LoadTaskOptions,
  Pnt3,
  Point3,
  Point4,
  Qtrn,
  throwIfAborted,
  warnOnce,
} from '../base';
import { Gg3dLevelLoader } from './level-loader';
import type { MapGraph3dEntity } from './entities/map-graph-3d.entity';
import { first } from 'rxjs';

/**
 * Whether `loadGgGlb` goes through the loader's asset cache. Left out, it does. `Nothing` fetches
 * and parses the file for that one call, outside the cache; `Files` and `Entities` both mean the
 * cached default (they used to select what was cached).
 */
export enum CachingStrategy {
  Nothing,
  Files,
  Entities,
}

export type LoadOptions = {
  /** See `CachingStrategy`. Cached when left out. */
  cachingStrategy?: CachingStrategy;
  // initial position
  position: Point3;
  // initial rotation
  rotation: Point4;
  // process dummies with flag is_prop
  loadProps: boolean;
  // path where to find prop scenes
  propsPath?: string;
  /**
   * Scope every produced entity's `name` under, so that the same file can be loaded any number of
   * times into one world without the (Blender-authored, hence identical on every load) object
   * names colliding - `GgWorld` enforces world-wide name uniqueness and `addEntity` rejects a
   * collision outright. Each entity is named `` `${nameScope}__${objectName}` `` (`objectName`
   * being the body's, else the display object's, own native name - falling back to the entity's
   * index in `entities` when neither has one), and every prop/scene dummy loaded via `loadProps`
   * recurses under `` `${nameScope}__${dummy.name}` `` - deterministic purely from `nameScope` and
   * the files' own content, so two peers loading the same asset under the same scope agree on
   * every name.
   * - a `string`: that scope, e.g. the `"Glb"` level entity class passes its own entity name;
   * - omitted/`undefined` (the default): a fresh process-unique scope (`` `glb_${n}` ``, `n` a
   *   per-process counter) - always collision-free, but not deterministic across peers/reloads;
   * - `null`: no scoping at all - entities keep their raw native object names. Opt in to this
   *   only to look entities up by their Blender names, and only when the file is loaded once.
   */
  nameScope?: string | null;
  /**
   * When set, every loaded display object (including nested props) gets this `castShadow` value,
   * see `IDisplayObject3dComponent.castShadow`. Left as authored in the file when omitted.
   */
  castShadow?: boolean;
  /** Same as `castShadow`, for `IDisplayObject3dComponent.receiveShadow`. */
  receiveShadow?: boolean;
};

const defaultLoadOptions: LoadOptions = {
  position: Pnt3.O,
  rotation: Qtrn.O,
  loadProps: true,
};

export type LoadResourcesResult<TypeDoc extends Gg3dWorldTypeDocRepo = Gg3dWorldTypeDocRepo> = {
  resources: { object3D: TypeDoc['vTypeDoc']['displayObject'] | null; body: TypeDoc['pTypeDoc']['rigidBody'] | null }[];
  meta: GgMeta;
};

export type LoadResult<TypeDoc extends Gg3dWorldTypeDocRepo = Gg3dWorldTypeDocRepo> = {
  entities: Entity3d<TypeDoc>[];
  meta: GgMeta;
};

const cloneLoadResourcesResult = <TypeDoc extends Gg3dWorldTypeDocRepo = Gg3dWorldTypeDocRepo>(
  loadResult: LoadResourcesResult<TypeDoc>,
) => ({
  meta: loadResult.meta, // TODO deep clone it
  resources: loadResult.resources.map(({ object3D, body }) => ({
    object3D: object3D && object3D.clone(),
    body: body && body.clone(),
  })),
});

export type LoadResultWithProps<TypeDoc extends Gg3dWorldTypeDocRepo = Gg3dWorldTypeDocRepo> = LoadResult<TypeDoc> & {
  props?: LoadResult<TypeDoc>[];
};

/**
 * Flatten a `LoadResultWithProps` (and its recursively-nested `props`) into one flat list of every
 * `Entity3d` it produced, for the built-in `"Glb"` level entity class to parent under a single
 * `GroupEntity`.
 */
function flattenGlbEntities<TypeDoc extends Gg3dWorldTypeDocRepo>(
  result: LoadResultWithProps<TypeDoc>,
): Entity3d<TypeDoc>[] {
  return [...result.entities, ...(result.props ?? []).flatMap(prop => flattenGlbEntities(prop))];
}

/**
 * Settings for the built-in `"Glb"` level entity class (3D only): loads a GG GLB+meta pair via
 * `Gg3dLoader.loadGgGlb` and returns every entity it produces (the model itself, plus any nested
 * props/scenes) grouped under one `GroupEntity`.
 */
export interface Glb3DSettings {
  /**
   * Path (URL or path prefix, without extension) to the `.glb`/`.meta` pair - passed straight
   * through to `loadGgGlb`
   */
  path: string;

  /**
   * Position of the loaded model
   */
  position?: Point3;

  /**
   * Rotation of the loaded model
   */
  rotation?: Point4;

  /**
   * Caching strategy, see `CachingStrategy`. Cached when left out, same as `loadGgGlb` itself.
   */
  cachingStrategy?: CachingStrategy;

  /**
   * Whether to also load dummies flagged as props/scenes. Defaults to `true`, same as `loadGgGlb`.
   */
  loadProps?: boolean;

  /**
   * Path where to find prop scenes, if different from `path`'s own directory
   */
  propsPath?: string;

  /**
   * Scope for the names of every entity the GLB produces, see `LoadOptions.nameScope`. Defaults to
   * this `"Glb"` entity's own resolved `name` (`name`, below) - which `LevelLoader.loadLevel`
   * guarantees is unique in the world and deterministic per level document - so two `"Glb"`
   * entries pointing at the same file never collide. `null` keeps the raw native object names.
   */
  nameScope?: string | null;

  /**
   * Whether the loaded model casts shadows, see `LoadOptions.castShadow`. Left as authored in the
   * file when omitted.
   */
  castShadow?: boolean;

  /**
   * Whether the loaded model receives shadows, see `LoadOptions.receiveShadow`. Left as authored in
   * the file when omitted.
   */
  receiveShadow?: boolean;

  /**
   * The entity's own resolved name - filled in by `LevelLoader.createEntity`/`loadLevel` (explicit
   * `EntityJson.name`, else the level-derived fallback), not meant to be set in `config`
   */
  name?: string;
}

/**
 * Full 3D loader exposed as `Gg3dWorld.loader`: GLB+meta asset loading (`loadGgGlb` and friends)
 * layered on top of `Gg3dLevelLoader`, so `registerClass`/`loadLevel`/`loadLevelFromUrl`/
 * `getEntityByName` are all available directly on `world.loader`. Also registers a `"Glb"` level
 * entity class (see `Glb3DSettings`) so a level JSON can place a GLB model declaratively, the same
 * way it places primitives/triggers/cameras.
 * @template TypeDoc - The type document repository
 */
export class Gg3dLoader<TypeDoc extends Gg3dWorldTypeDocRepo = Gg3dWorldTypeDocRepo> extends Gg3dLevelLoader<TypeDoc> {
  // backs `loadGgGlb`'s default (process-unique) `nameScope`, see `LoadOptions.nameScope`
  private static nameScopeCounter = 0;

  constructor(world: Gg3dWorld<TypeDoc>) {
    super(world);
    const generator = async (w: Gg3dWorld<TypeDoc>, settings: Glb3DSettings, load: LoadTaskOptions = {}) => {
      if (!settings.path) {
        throw new Error('Path is required for Glb class');
      }
      const {
        path,
        position,
        rotation,
        cachingStrategy,
        loadProps,
        propsPath,
        nameScope,
        castShadow,
        receiveShadow,
        name,
      } = settings;
      const result = await this.loadGgGlb(path, {
        ...load,
        ...(position !== undefined ? { position } : {}),
        ...(rotation !== undefined ? { rotation } : {}),
        ...(cachingStrategy !== undefined ? { cachingStrategy } : {}),
        ...(loadProps !== undefined ? { loadProps } : {}),
        ...(propsPath !== undefined ? { propsPath } : {}),
        ...(castShadow !== undefined ? { castShadow } : {}),
        ...(receiveShadow !== undefined ? { receiveShadow } : {}),
        // explicit scope wins; else the entity's own (unique, level-deterministic) name; else
        // (a bare createEntity with no name) loadGgGlb's own process-unique default
        nameScope: nameScope !== undefined ? nameScope : name,
      });
      const group = new GroupEntity<Point3, Point4, TypeDoc>();
      group.addChildren(...flattenGlbEntities(result));
      return group;
    };
    this.registerClass('Glb', generator, {
      assets: (settings: Glb3DSettings) =>
        settings.path && settings.cachingStrategy !== CachingStrategy.Nothing
          ? [{ kind: 'ggGlb', url: settings.path, loadProps: settings.loadProps, propsPath: settings.propsPath }]
          : [],
    });
  }

  /**
   * Fetches a `.glb`/`.meta` pair. Nothing is cached here - `loadGgGlb` is the cached entry point.
   * @param path - Path (URL or path prefix, without extension) to the pair
   * @param options - Progress callback and abort signal
   */
  public async loadGgGlbFiles(path: string, options: LoadTaskOptions = {}): Promise<[ArrayBuffer, GgMeta]> {
    const item = new AssetProgress(path, options.onProgress);
    const signal = linkSignals(options.signal, this.assetCache.lifetimeSignal);
    try {
      const result = await this.fetchGgGlb(path, item, signal.signal);
      item.done();
      return result;
    } finally {
      signal.release();
    }
  }

  private async fetchGgGlb(
    path: string,
    item: AssetProgress,
    signal: AbortSignal | undefined,
  ): Promise<[ArrayBuffer, GgMeta]> {
    const [glb, metaData] = await Promise.all([
      fetchWithProgress(`${path}.glb`, item.file(), signal),
      fetchWithProgress(`${path}.meta`, item.file(), signal),
    ]);
    const meta: GgMeta = JSON.parse(new TextDecoder().decode(metaData));
    if (meta.formatVersion !== undefined && meta.formatVersion > GG_META_SUPPORTED_FORMAT_VERSION) {
      warnOnce(
        `${path}.meta declares formatVersion ${meta.formatVersion}, but this build of ` +
          `@gg-web-engine/core only understands up to ${GG_META_SUPPORTED_FORMAT_VERSION}. ` +
          `Update @gg-web-engine/core, or re-export with an older version of the GG Web Engine Exporter add-on.`,
      );
    }
    return [glb, meta];
  }

  /** Fetches and parses a pair into display objects and bodies that own their resources. */
  private async buildGgGlbResources(
    path: string,
    item: AssetProgress,
    signal: AbortSignal | undefined,
  ): Promise<LoadResourcesResult<TypeDoc>> {
    const [glb, meta] = await this.fetchGgGlb(path, item, signal);
    const [object, bodies] = await Promise.all([
      this.world.visualScene?.loader.loadFromGgGlb(glb, meta),
      this.world.physicsWorld?.loader.loadFromGgGlb(glb, meta),
    ]);
    const result: LoadResourcesResult<TypeDoc> = { resources: [], meta };
    if (!object) {
      return result;
    }
    // before the object is split up: prepared as a whole, in one pass
    await this.world.visualScene?.loader.prepare?.(object);
    if (bodies?.length == 0) {
      result.resources.push({ object3D: object, body: null });
    } else if (bodies?.length == 1) {
      result.resources.push({ object3D: object, body: bodies[0] });
    } else {
      for (const body of bodies || []) {
        result.resources.push({ object3D: object.popChild(body.name), body });
      }
      if (!object.isEmpty()) {
        result.resources.push({ object3D: object, body: null });
      }
    }
    return result;
  }

  /** The cached, never-spawned original of a pair - `loadGgGlbResources` hands out copies of it. */
  private acquireGgGlb(path: string, options: LoadTaskOptions): Promise<LoadResourcesResult<TypeDoc>> {
    return this.acquireAsset(`ggGlb:${path}`, path, options, async (item, signal) => {
      const template = await this.buildGgGlbResources(path, item, signal);
      return {
        value: template,
        dispose: () => {
          for (const { object3D, body } of template.resources) {
            object3D?.dispose();
            body?.dispose();
          }
        },
      };
    });
  }

  /**
   * Loads a `.glb`/`.meta` pair into display objects and bodies, not yet wrapped in entities. The
   * pair is fetched and parsed once per world and kept in the loader's cache; every call gets its
   * own copies (`clone()`) to place, which share the cached original's geometry, materials and
   * collision shapes. `CachingStrategy.Nothing` skips the cache: the pair is fetched and parsed
   * for this call alone, and the result owns its resources.
   */
  public async loadGgGlbResources(
    path: string,
    cachingStrategy?: CachingStrategy,
    options: LoadTaskOptions = {},
  ): Promise<LoadResourcesResult<TypeDoc>> {
    if (cachingStrategy === CachingStrategy.Nothing) {
      throwIfAborted(options.signal);
      const item = new AssetProgress(path, options.onProgress);
      const signal = linkSignals(options.signal, this.assetCache.lifetimeSignal);
      try {
        const result = await this.buildGgGlbResources(path, item, signal.signal);
        throwIfAborted(signal.signal);
        item.done();
        return result;
      } finally {
        signal.release();
      }
    }
    return cloneLoadResourcesResult(await this.acquireGgGlb(path, options));
  }

  /** The props/scenes a meta references, as further pairs to load. */
  private static propsOf(meta: GgMeta, path: string, propsPath: string | undefined) {
    return (meta.dummies || [])
      .filter(x => x.is_prop || x.is_scene)
      .map(dummy => ({
        dummy,
        path: dummy.is_prop
          ? (propsPath || path.substring(0, path.lastIndexOf('/') + 1)) + dummy.prop_id
          : (dummy.scene_id as string),
        loadProps: !!dummy.is_scene,
      }));
  }

  /** Brings a pair, and with `loadProps` everything it references, into the cache. */
  private async preloadGgGlb(
    path: string,
    loadProps: boolean,
    propsPath: string | undefined,
    options: LoadTaskOptions,
  ): Promise<void> {
    const group = new LoadProgressGroup(options);
    const rootSlot = group.sub();
    const propsSlot = group.sub();
    const { meta } = await this.acquireGgGlb(path, rootSlot);
    if (loadProps) {
      const props = new LoadProgressGroup(propsSlot);
      await Promise.all(
        Gg3dLoader.propsOf(meta, path, propsPath).map(prop =>
          this.preloadGgGlb(prop.path, prop.loadProps, undefined, props.sub()),
        ),
      );
    }
    group.complete(propsSlot);
    group.finish();
  }

  /**
   * Preloads the chunks `entity` loads first, with the level's progress and signal, held only until
   * the entity's own chunk scopes have taken them over - so they unload with their chunk like any
   * other.
   */
  protected override async preloadInitialChunks(
    entity: MapGraph3dEntity<TypeDoc>,
    load: LoadTaskOptions,
  ): Promise<void> {
    const hold = this.createAssetScope();
    try {
      await this.preload(
        entity.initialChunks
          .filter(node => node.loadOptions.cachingStrategy !== CachingStrategy.Nothing)
          .map(node => ({
            kind: 'ggGlb' as const,
            url: node.path,
            loadProps: node.loadOptions.loadProps ?? defaultLoadOptions.loadProps,
            propsPath: node.loadOptions.propsPath,
          })),
        { ...load, scope: hold },
      );
    } catch (e) {
      hold.release();
      throw e;
    }
    const release = () => hold.release();
    entity.initialLoadComplete$.pipe(first(complete => complete)).subscribe(release);
    entity.disposed$.subscribe({ next: release, complete: release });
  }

  protected override async preloadAsset(ref: AssetRef, options: LoadTaskOptions): Promise<void> {
    if (ref.kind === 'ggGlb') {
      await this.preloadGgGlb(ref.url, ref.loadProps ?? true, ref.propsPath, options);
    } else {
      await super.preloadAsset(ref, options);
    }
  }

  /**
   * Load a GG GLB+meta pair into ready-to-add `Entity3d`s (one per rigid body the `.meta`
   * declares, plus one for any body-less leftover geometry), recursively loading any prop/scene
   * dummies too when `options.loadProps` is on. Every entity's `name` is scoped under
   * `options.nameScope` (see `LoadOptions.nameScope` - a process-unique scope by default), so
   * loading the same file repeatedly never produces colliding names.
   * @param path - Path (URL or path prefix, without extension) to the `.glb`/`.meta` pair
   * @param options - See `LoadOptions`
   * @returns The produced entities (not yet added to the world), the parsed meta, and the
   * recursively loaded props
   */
  public async loadGgGlb(
    path: string,
    options: Partial<LoadOptions> & LoadTaskOptions = {},
  ): Promise<LoadResultWithProps<TypeDoc>> {
    const loadOptions = { ...defaultLoadOptions, ...options };
    const group = new LoadProgressGroup(options);
    const nameScope: string | null =
      loadOptions.nameScope === undefined ? `glb_${Gg3dLoader.nameScopeCounter++}` : loadOptions.nameScope;
    const rootSlot = group.sub();
    const propsSlot = group.sub();
    const { resources, meta } = await this.loadGgGlbResources(path, loadOptions.cachingStrategy, rootSlot);
    const result: LoadResultWithProps<TypeDoc> = {
      entities: resources.map((x, index) => {
        const entity = new Entity3d<TypeDoc>({ object3D: x.object3D, objectBody: x.body });
        if (nameScope !== null) {
          // Mirrors Entity3d's own constructor fallback order: object3D's name is only ever
          // considered when there is no body at all, not merely whenever the body happens to be
          // unnamed - a body-having resource whose body.name is empty falls straight to the index,
          // the same way Entity3d itself would leave such an entity at its generated default name
          // rather than reaching past a present-but-unnamed objectBody for object3D.name.
          const objectName = x.body ? x.body.name || `${index}` : x.object3D?.name || `${index}`;
          entity.name = `${nameScope}__${objectName}`;
        }
        return entity;
      }),
      meta,
    };
    if (loadOptions.loadProps) {
      const props = new LoadProgressGroup(propsSlot);
      result.props = await Promise.all(
        Gg3dLoader.propsOf(meta, path, loadOptions.propsPath).map(({ dummy, path: propPath, loadProps }) =>
          this.loadGgGlb(propPath, {
            ...props.sub(),
            loadProps,
            position: Pnt3.add(Pnt3.rot(dummy.position, loadOptions.rotation), loadOptions.position),
            rotation: Qtrn.combineRotations(dummy.rotation, loadOptions.rotation),
            nameScope: nameScope === null ? null : `${nameScope}__${dummy.name}`,
            ...(loadOptions.cachingStrategy !== undefined ? { cachingStrategy: loadOptions.cachingStrategy } : {}),
            ...(loadOptions.castShadow !== undefined ? { castShadow: loadOptions.castShadow } : {}),
            ...(loadOptions.receiveShadow !== undefined ? { receiveShadow: loadOptions.receiveShadow } : {}),
          }),
        ),
      );
    }
    result.entities.forEach(e => {
      if (e.object3D && loadOptions.castShadow !== undefined) {
        e.object3D.castShadow = loadOptions.castShadow;
      }
      if (e.object3D && loadOptions.receiveShadow !== undefined) {
        e.object3D.receiveShadow = loadOptions.receiveShadow;
      }
      e.position = Pnt3.add(Pnt3.rot(Pnt3.clone(e.position), loadOptions.rotation), loadOptions.position);
      // FIXME this rotation is wrong
      e.rotation = Qtrn.mult(Qtrn.clone(e.rotation), loadOptions.rotation);
    });
    group.complete(propsSlot);
    group.finish();
    return result;
  }
}
