import { Gg2dWorldTypeDocRepo } from './gg-2d-world';
import { Gg2dLevelLoader } from './level-loader';

/**
 * Full loader exposed as `Gg2dWorld.loader`, extending `Gg2dLevelLoader` (so
 * `registerClass`/`loadLevel`/`loadLevelFromUrl`/`getEntityByName` are all available directly on
 * `world.loader`) - kept as its own class/type so 2D can grow other loading capabilities (the way
 * `Gg3dLoader` has GLB loading) without a breaking rename.
 * @template TypeDoc - The type document repository
 */
export class Gg2dLoader<TypeDoc extends Gg2dWorldTypeDocRepo = Gg2dWorldTypeDocRepo> extends Gg2dLevelLoader<TypeDoc> {}
