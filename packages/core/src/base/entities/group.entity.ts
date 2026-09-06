import { GgWorldTypeDocRepo } from '../gg-world';
import { IEntity, TickOrder } from './i-entity';

/**
 * A trivial entity with no rendering/physics of its own: it exists purely as a parent/grouping
 * node. `LevelLoader.loadLevel`/`loadLevelFromUrl` hand one back for every loaded level - every
 * entity the level's JSON produced is added as one of its children (see `IEntity.addChildren`),
 * so the whole level can be torn down in a single call:
 * `world.removeEntity(level, true)` cascades removal + disposal to every child
 * (see `IEntity.onRemoved`/`dispose`). Also used internally to group the several entities a single
 * multi-piece GLB load can produce under one name (see the built-in `"Glb"` level entity class).
 * @template D - The position type
 * @template R - The rotation type
 * @template TypeDoc - The type document repository
 */
export class GroupEntity<
  D = any,
  R = any,
  TypeDoc extends GgWorldTypeDocRepo<D, R> = GgWorldTypeDocRepo<D, R>,
> extends IEntity<D, R, TypeDoc> {
  public readonly tickOrder = TickOrder.OBJECTS_BINDING;
}
