import { Gg3dWorld, Gg3dWorldTypeDocRepo } from './gg-3d-world';
import { GgMeta } from './models/gg-meta';
import { Entity3d } from './entities/entity-3d';
import { Pnt3, Point3, Point4, Qtrn } from '../base';

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

export class Gg3dLoader<TypeDoc extends Gg3dWorldTypeDocRepo = Gg3dWorldTypeDocRepo> {
  readonly filesCache: Map<string, [ArrayBuffer, GgMeta] | Promise<[ArrayBuffer, GgMeta]>> = new Map<
    string,
    [ArrayBuffer, GgMeta] | Promise<[ArrayBuffer, GgMeta]>
  >();

  readonly loadResultCache: Map<string, LoadResourcesResult<TypeDoc> | Promise<LoadResourcesResult<TypeDoc>>> = new Map<
    string,
    LoadResourcesResult<TypeDoc> | Promise<LoadResourcesResult<TypeDoc>>
  >();

  constructor(protected readonly world: Gg3dWorld) {}

  public async loadGgGlbFiles(path: string, useCache: boolean = false): Promise<[ArrayBuffer, GgMeta]> {
    if (useCache && this.filesCache.has(path)) {
      return this.filesCache.get(path)!;
    }
    const loadPromise = Promise.all([
      fetch(`${path}.glb`).then(r => r.arrayBuffer()),
      fetch(`${path}.meta`)
        .then(r => r.text())
        .then(r => JSON.parse(r)),
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
      this.world.visualScene.loader.loadFromGgGlb(glb, meta),
      this.world.physicsWorld.loader.loadFromGgGlb(glb, meta),
    ]);
    const result: LoadResourcesResult<TypeDoc> = { resources: [], meta };
    if (!object) {
      return result;
    }
    if (bodies.length == 0) {
      result.resources.push({ object3D: object, body: null });
    } else if (bodies.length == 1) {
      result.resources.push({ object3D: object, body: bodies[0] });
    } else {
      for (const body of bodies) {
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

  public async loadGgGlb(
    path: string,
    options: Partial<LoadOptions> = defaultLoadOptions,
  ): Promise<LoadResultWithProps<TypeDoc>> {
    const loadOptions = { ...defaultLoadOptions, ...options };
    const { resources, meta } = await this.loadGgGlbResources(path, loadOptions.cachingStrategy);
    const result: LoadResultWithProps<TypeDoc> = {
      entities: resources.map(x => new Entity3d({ object3D: x.object3D, objectBody: x.body })),
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
