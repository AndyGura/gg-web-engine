import { Gg3dWorld } from './gg-3d-world';
import { IGg3dBody, IGg3dObject } from './interfaces';
import { GgMeta } from './models/gg-meta';

export class Gg3dLoader {

  constructor(protected readonly world: Gg3dWorld) {
  }

  public async loadGgGlb(path: string, filename: string): Promise<[IGg3dObject | null, IGg3dBody | null, GgMeta]> {
    // TODO support multiple separate entities in one glb
    const [glb, meta] = await Promise.all([
      fetch(`${path}${filename}.glb`).then(r => r.arrayBuffer()),
      fetch(`${path}${filename}.meta`).then(r => r.text()).then(r => JSON.parse(r)),
    ]);
    if (!glb) {
      throw new Error('GLB not found');
    }
    const [object, body] = await Promise.all([
      this.world.visualScene.loader.loadFromGgGlb(glb, meta),
      this.world.physicsWorld.loader.loadFromGgGlb(glb, meta),
    ])
    return [object, body, meta];
  }

}
