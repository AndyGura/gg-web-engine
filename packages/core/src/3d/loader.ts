import { Gg3dWorld } from './gg-3d-world';
import { GgMeta } from './models/gg-meta';
import { Gg3dEntity } from './entities/gg-3d-entity';
import { Point3, Point4 } from '../base/models/points';
import { Pnt3 } from '../base/math/point3';
import { Qtrn } from '../base/math/quaternion';
import { IGg3dBody, IGg3dObject } from './interfaces';

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

export type LoadResourcesResult = { resources: { object3D: IGg3dObject | null, body: IGg3dBody | null }[], meta: GgMeta };

export type LoadResult = {
  entities: Gg3dEntity[],
  meta: GgMeta
};

export class Gg3dLoader {

  constructor(protected readonly world: Gg3dWorld) {
  }

  public async loadGgGlbResources(path: string): Promise<LoadResourcesResult> {
    const [glb, meta] = await Promise.all([
      fetch(`${path}.glb`).then(r => r.arrayBuffer()),
      fetch(`${path}.meta`).then(r => r.text()).then(r => JSON.parse(r)),
    ]);
    if (!glb) {
      throw new Error('GLB not found');
    }
    const [object, bodies] = await Promise.all([
      this.world.visualScene.loader.loadFromGgGlb(glb, meta),
      this.world.physicsWorld.loader.loadFromGgGlb(glb, meta),
    ]);
    const result: LoadResourcesResult = { resources: [], meta };
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
    return result;
  }

  public async loadGgGlb(path: string, options: Partial<LoadOptions> = defaultLoadOptions): Promise<LoadResult & { props?: LoadResult[] }> {
    const loadOptions = { ...defaultLoadOptions, ...options };
    const { resources, meta } = await this.loadGgGlbResources(path);
    const result: LoadResult & { props?: LoadResult[] } = {
      entities: resources.map(({ object3D, body }) => new Gg3dEntity(object3D, body)),
      meta,
    }
    if (loadOptions.loadProps) {
      result.props =
        await Promise.all((meta as GgMeta).dummies
          .filter(x => x.is_prop || x.is_scene)
          .map(dummy => this.loadGgGlb(
            dummy.is_prop ? (loadOptions.propsPath || path.substring(0, path.lastIndexOf('/') + 1)) + dummy.prop_id : dummy.scene_id,
            {
              loadProps: !!dummy.is_scene,
              position: Pnt3.add(Pnt3.rot(dummy.position, loadOptions.rotation), loadOptions.position),
              rotation: Qtrn.combineRotations(dummy.rotation, loadOptions.rotation),
            },
          ))
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
