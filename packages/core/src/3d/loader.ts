import { Gg3dWorld } from './gg-3d-world';
import { GgMeta } from './models/gg-meta';
import { Gg3dEntity } from './entities/gg-3d-entity';

export class Gg3dLoader {

  constructor(protected readonly world: Gg3dWorld) {
  }

  public async loadGgGlb(path: string, filename: string): Promise<[Gg3dEntity[], GgMeta]> {
    const [glb, meta] = await Promise.all([
      fetch(`${path}${filename}.glb`).then(r => r.arrayBuffer()),
      fetch(`${path}${filename}.meta`).then(r => r.text()).then(r => JSON.parse(r)),
    ]);
    if (!glb) {
      throw new Error('GLB not found');
    }
    const [object, bodies] = await Promise.all([
      this.world.visualScene.loader.loadFromGgGlb(glb, meta),
      this.world.physicsWorld.loader.loadFromGgGlb(glb, meta),
    ]);
    if (!object) {
      return [[], meta];
    }
    if (bodies.length == 0) {
      return [[new Gg3dEntity(object, null)], meta];
    } else if (bodies.length == 1) {
      return [[new Gg3dEntity(object, bodies[0])], meta];
    } else {
      // TODO implement hierarchy between entities and preserve it here
      const res: Gg3dEntity[] = [];
      for (const body of bodies) {
        const subObj = object.popChild(body.name);
        res.push(new Gg3dEntity(subObj, body));
      }
      if (!object.isEmpty()) {
        res.push(new Gg3dEntity(object, null));
      }
      return [res, meta];
    }
  }

}
