import { Gg3dWorld } from './gg-3d-world';
import { GgMeta } from './models/gg-meta';
import { Gg3dEntity } from './entities/gg-3d-entity';

export type LoadOptions = {
  loadProps: boolean;
  propsPath?: string;
};

const defaultLoadOptions: LoadOptions = {
  loadProps: true,
}

export class Gg3dLoader {

  constructor(protected readonly world: Gg3dWorld) {
  }

  public async loadGgGlb(path: string, options: Partial<LoadOptions> = defaultLoadOptions): Promise<[Gg3dEntity[], GgMeta]> {
    const loadOptions = { ...defaultLoadOptions, ...options };
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
    if (!object) {
      return [[], meta];
    }
    const res: Gg3dEntity[] = [];
    // TODO implement hierarchy between entities and preserve it here
    if (loadOptions.loadProps) {
      // TODO prop positions lost here!
      await Promise.all((meta as GgMeta).dummies
        .filter(x => x.is_prop)
        .map(dummy => this.loadGgGlb((loadOptions.propsPath || path.substring(0, path.lastIndexOf('/') + 1)) + dummy.prop_id)))
        .then(props => {
          res.push(...props.reduce((prev, next) => {
            prev.push(...next[0]);
            return prev;
          }, [] as Gg3dEntity[]));
        });
    }
    if (bodies.length == 0) {
      res.push(new Gg3dEntity(object, null));
    } else if (bodies.length == 1) {
      res.push(new Gg3dEntity(object, bodies[0]));
    } else {
      // TODO implement hierarchy between entities and preserve it here
      for (const body of bodies) {
        res.push(new Gg3dEntity(object.popChild(body.name), body));
      }
      if (!object.isEmpty()) {
        res.push(new Gg3dEntity(object, null));
      }
    }
    return [res, meta];
  }

}
