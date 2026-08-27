import { GgWorldTypeDocRepo } from '../../gg-world';
import { IEntity } from '../../entities/i-entity';
import { BlueprintNode, BlueprintPinDefinition } from '../blueprint-node';

/**
 * Settings for the built-in `"RemoveEntity"` blueprint node - baked in from its
 * {@link BlueprintNodeJson.settings}, not wired at runtime.
 */
export interface RemoveEntityNodeSettings {
  /**
   * Whether to dispose the entity (release its components/children) as well as remove it from
   * the world, same as the `dispose` argument of `GgWorld.removeEntity`. Defaults to `false`.
   */
  dispose?: boolean;
}

/**
 * Built-in blueprint node: removes an entity from the world - the blueprint analogue of calling
 * `world.removeEntity(entity, dispose)` directly. Has one input pin, `"entity"` (a data pin that
 * also acts as this node's trigger - feeding it a value runs the node, same as an Unreal event
 * node's payload pin doubling as its exec pulse) and no output pins. Whether the removal also
 * disposes the entity is controlled by the static `dispose` setting, not a pin - see
 * {@link RemoveEntityNodeSettings}.
 */
export class RemoveEntityBlueprintNode<
  D = any,
  R = any,
  TypeDoc extends GgWorldTypeDocRepo<D, R> = GgWorldTypeDocRepo<D, R>,
> extends BlueprintNode<D, R, TypeDoc> {
  public readonly inputs: readonly BlueprintPinDefinition[] = [{ name: 'entity', kind: 'data' }];
  public readonly outputs: readonly BlueprintPinDefinition[] = [];

  public trigger(inputName: string, value?: unknown): void {
    if (inputName !== 'entity') {
      return;
    }
    if (!(value instanceof IEntity)) {
      console.warn('RemoveEntity blueprint node triggered without a valid entity reference - ignoring');
      return;
    }
    const settings = this.settings as RemoveEntityNodeSettings;
    this.world.removeEntity(value, settings.dispose ?? false);
  }
}
