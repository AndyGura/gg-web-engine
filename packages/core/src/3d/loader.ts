import { Gg3dWorld } from './gg-3d-world';
import { GgMeta } from './models/gg-meta';
import { Gg3dEntity } from './entities/gg-3d-entity';
import { Point3, Point4 } from '../base/models/points';

export type LoadOptions = {
  loadProps: boolean;
  propsPath?: string;
};

const defaultLoadOptions: LoadOptions = {
  loadProps: true,
};

export type LoadResult = {
  entities: Gg3dEntity[],
  meta: GgMeta
};

export type PropDefinition = LoadResult & { position: Point3, rotation: Point4 };

export class Gg3dLoader {

  constructor(protected readonly world: Gg3dWorld) {
  }

  public async loadGgGlb(path: string, options: Partial<LoadOptions> = defaultLoadOptions): Promise<LoadResult & { props?: PropDefinition[] }> {
    const loadOptions = { ...defaultLoadOptions, ...options };
    const [glb, meta] = await Promise.all([
      fetch(`${path}.glb`).then(r => r.arrayBuffer()),
      fetch(`${path}.meta`).then(r => r.text()).then(r => JSON.parse(r)),
    ]);
    if (!glb) {
      throw new Error('GLB not found');
    }
    const result: LoadResult & { props?: PropDefinition[] } = {
      entities: [],
      meta,
    }
    const [object, bodies] = await Promise.all([
      this.world.visualScene.loader.loadFromGgGlb(glb, meta),
      this.world.physicsWorld.loader.loadFromGgGlb(glb, meta),
    ]);
    if (!object) {
      return result;
    }
    if (loadOptions.loadProps) {
      result.props = (
        await Promise.all((meta as GgMeta).dummies
          .filter(x => x.is_prop)
          .map(dummy => this.loadGgGlb((loadOptions.propsPath || path.substring(0, path.lastIndexOf('/') + 1)) + dummy.prop_id, { loadProps: false }).then(r => [dummy, r]))
        ))
        .map(([metaDescr, loadedProp]) => ({
          ...loadedProp,
          position: metaDescr.position,
          rotation: metaDescr.rotation,
        }));
    }
    if (bodies.length == 0) {
      result.entities.push(new Gg3dEntity(object, null));
    } else if (bodies.length == 1) {
      result.entities.push(new Gg3dEntity(object, bodies[0]));
    } else {
      // TODO implement hierarchy between entities and preserve it here
      for (const body of bodies) {
        result.entities.push(new Gg3dEntity(object.popChild(body.name), body));
      }
      if (!object.isEmpty()) {
        result.entities.push(new Gg3dEntity(object, null));
      }
    }
    return result;
  }

}
