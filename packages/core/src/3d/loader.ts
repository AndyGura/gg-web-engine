import { Gg3dWorld } from './gg-3d-world';
import { GgMeta } from './models/gg-meta';
import { Gg3dEntity } from './entities/gg-3d-entity';
import { Point3, Point4 } from '../base/models/points';
import { Pnt3 } from '../base/math/point3';
import { Qtrn } from '../base/math/quaternion';

export type LoadOptions = {
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
  position: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  loadProps: true,
};

export type LoadResult = {
  entities: Gg3dEntity[],
  meta: GgMeta
};

export class Gg3dLoader {

  constructor(protected readonly world: Gg3dWorld) {
  }

  public async loadGgGlb(path: string, options: Partial<LoadOptions> = defaultLoadOptions): Promise<LoadResult & { props?: LoadResult[] }> {
    const loadOptions = { ...defaultLoadOptions, ...options };
    const [glb, meta] = await Promise.all([
      fetch(`${path}.glb`).then(r => r.arrayBuffer()),
      fetch(`${path}.meta`).then(r => r.text()).then(r => JSON.parse(r)),
    ]);
    if (!glb) {
      throw new Error('GLB not found');
    }
    const result: LoadResult & { props?: LoadResult[] } = {
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
      result.props =
        await Promise.all((meta as GgMeta).dummies
          .filter(x => x.is_prop)
          .map(dummy => this.loadGgGlb(
            (loadOptions.propsPath || path.substring(0, path.lastIndexOf('/') + 1)) + dummy.prop_id,
            {
              loadProps: false,
              position: Pnt3.add(Pnt3.rot(Pnt3.clone(dummy.position), loadOptions.rotation), loadOptions.position),
              rotation: Qtrn.mult(Qtrn.clone(dummy.rotation), loadOptions.rotation),
            },
          ))
        );
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
    result.entities.forEach(e => {
      e.position = Pnt3.add(Pnt3.rot(Pnt3.clone(e.position), loadOptions.rotation), loadOptions.position);
      // FIXME this rotation is wrong
      e.rotation = Qtrn.mult(Qtrn.clone(e.rotation), loadOptions.rotation);
    });
    return result;
  }

}
