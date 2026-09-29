import { Gg3dWorld, Gg3dWorldTypeDocRepo } from './gg-3d-world';
import { GG_META_SUPPORTED_FORMAT_VERSION, GgMeta } from './models/gg-meta';
import { Entity3d } from './entities/entity-3d';
import { GroupEntity, Pnt3, Point3, Point4, Qtrn, warnOnce } from '../base';
import { Gg3dLevelLoader } from './level-loader';
import { LoadGlbOptions } from './loaders';

export enum CachingStrategy {
  Nothing,
  Files,
  Entities,
}

export type LoadOptions = {
  // whether to cache anything
  // "Nothing" does not cache anything
  // "Files" caches GLB+Meta file contents
  // "Entities" clones and saves parsed from GLB+Meta objects and bodies
  cachingStrategy: CachingStrategy;
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
};

const defaultLoadOptions: LoadOptions = {
  cachingStrategy: CachingStrategy.Nothing,
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
   * Caching strategy, see `CachingStrategy`. Defaults to `CachingStrategy.Nothing`, same as
   * `loadGgGlb` itself.
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

  readonly filesCache: Map<string, [ArrayBuffer, GgMeta] | Promise<[ArrayBuffer, GgMeta]>> = new Map<
    string,
    [ArrayBuffer, GgMeta] | Promise<[ArrayBuffer, GgMeta]>
  >();

  readonly loadResultCache: Map<string, LoadResourcesResult<TypeDoc> | Promise<LoadResourcesResult<TypeDoc>>> = new Map<
    string,
    LoadResourcesResult<TypeDoc> | Promise<LoadResourcesResult<TypeDoc>>
  >();

  constructor(world: Gg3dWorld<TypeDoc>) {
    super(world);
    this.registerClass('Glb', async (w: Gg3dWorld<TypeDoc>, settings: Glb3DSettings) => {
      if (!settings.path) {
        throw new Error('Path is required for Glb class');
      }
      const { path, position, rotation, cachingStrategy, loadProps, propsPath, nameScope, name } = settings;
      const result = await this.loadGgGlb(path, {
        ...(position !== undefined ? { position } : {}),
        ...(rotation !== undefined ? { rotation } : {}),
        ...(cachingStrategy !== undefined ? { cachingStrategy } : {}),
        ...(loadProps !== undefined ? { loadProps } : {}),
        ...(propsPath !== undefined ? { propsPath } : {}),
        // explicit scope wins; else the entity's own (unique, level-deterministic) name; else
        // (a bare createEntity with no name) loadGgGlb's own process-unique default
        nameScope: nameScope !== undefined ? nameScope : name,
      });
      const group = new GroupEntity<Point3, Point4, TypeDoc>();
      group.addChildren(...flattenGlbEntities(result));
      return group;
    });
  }

  public async loadGgGlbFiles(path: string, useCache: boolean = false): Promise<[ArrayBuffer, GgMeta]> {
    if (useCache && this.filesCache.has(path)) {
      return this.filesCache.get(path)!;
    }
    const loadPromise = Promise.all([
      fetch(`${path}.glb`).then(r => r.arrayBuffer()),
      fetch(`${path}.meta`)
        .then(r => r.text())
        .then(r => JSON.parse(r))
        .then((meta: GgMeta) => {
          if (meta.formatVersion !== undefined && meta.formatVersion > GG_META_SUPPORTED_FORMAT_VERSION) {
            warnOnce(
              `${path}.meta declares formatVersion ${meta.formatVersion}, but this build of ` +
                `@gg-web-engine/core only understands up to ${GG_META_SUPPORTED_FORMAT_VERSION}. ` +
                `Update @gg-web-engine/core, or re-export with an older version of the GG Web Engine Exporter add-on.`,
            );
          }
          return meta;
        }),
    ]);
    if (useCache) {
      this.filesCache.set(path, loadPromise);
    }
    const result = await loadPromise;
    if (useCache) {
      this.filesCache.set(path, result);
    }
    return result;
  }

  public async loadGgGlbResources(
    path: string,
    cachingStrategy: CachingStrategy = CachingStrategy.Nothing,
  ): Promise<LoadResourcesResult<TypeDoc>> {
    if (cachingStrategy == CachingStrategy.Entities && this.loadResultCache.has(path)) {
      const cached = this.loadResultCache.get(path);
      const cachedResult = cached instanceof Promise ? await cached : cached;
      return cloneLoadResourcesResult(cachedResult!);
    }
    const [glb, meta] = await this.loadGgGlbFiles(path, cachingStrategy == CachingStrategy.Files);
    if (!glb) {
      throw new Error('GLB not found');
    }
    const [object, bodies] = await Promise.all([
      this.world.visualScene?.loader.loadFromGgGlb(glb, meta),
      this.world.physicsWorld?.loader.loadFromGgGlb(glb, meta),
    ]);
    const result: LoadResourcesResult<TypeDoc> = { resources: [], meta };
    if (!object) {
      return result;
    }
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
    if (cachingStrategy == CachingStrategy.Entities) {
      this.loadResultCache.set(path, cloneLoadResourcesResult(result));
    }
    return result;
  }

  /**
   * Loads a plain `.glb` (no `.meta` pair - see `loadGgGlb`) via `visualScene.loader.loadFromGlb`,
   * for a visual-only asset that has no physics representation of its own (a character model
   * driven by a separately-created `CharacterController3dEntity`'s capsule, a decorative prop, ...).
   * `undefined`/`null` if there's no visual scene to load against.
   * @param path - Path (URL or path prefix, without extension) to the `.glb` file
   * @param options - See `LoadGlbOptions`
   */
  public async loadModel(path: string, options?: LoadGlbOptions): Promise<TypeDoc['vTypeDoc']['displayObject'] | null> {
    if (!this.world.visualScene) {
      return null;
    }
    const glb = await fetch(`${path}.glb`).then(r => r.arrayBuffer());
    return this.world.visualScene.loader.loadFromGlb(glb, options);
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
    options: Partial<LoadOptions> = defaultLoadOptions,
  ): Promise<LoadResultWithProps<TypeDoc>> {
    const loadOptions = { ...defaultLoadOptions, ...options };
    const nameScope: string | null =
      loadOptions.nameScope === undefined ? `glb_${Gg3dLoader.nameScopeCounter++}` : loadOptions.nameScope;
    const { resources, meta } = await this.loadGgGlbResources(path, loadOptions.cachingStrategy);
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
      result.props = await Promise.all(
        (meta as GgMeta).dummies
          .filter(x => x.is_prop || x.is_scene)
          .map(dummy =>
            this.loadGgGlb(
              dummy.is_prop
                ? (loadOptions.propsPath || path.substring(0, path.lastIndexOf('/') + 1)) + dummy.prop_id
                : dummy.scene_id,
              {
                loadProps: !!dummy.is_scene,
                position: Pnt3.add(Pnt3.rot(dummy.position, loadOptions.rotation), loadOptions.position),
                rotation: Qtrn.combineRotations(dummy.rotation, loadOptions.rotation),
                nameScope: nameScope === null ? null : `${nameScope}__${dummy.name}`,
              },
            ),
          ),
      );
    }
    result.entities.forEach(e => {
      e.position = Pnt3.add(Pnt3.rot(Pnt3.clone(e.position), loadOptions.rotation), loadOptions.position);
      // FIXME this rotation is wrong
      e.rotation = Qtrn.mult(Qtrn.clone(e.rotation), loadOptions.rotation);
    });
    return result;
  }
}
