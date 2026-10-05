import { IEntity, Point2, TickOrder } from '../../base';
import { applyEnvironmentOverride, removeEnvironmentOverride } from '../../base/environment-overrides';
import { Gg2dWorld, Gg2dWorldTypeDocVPatch, VisualTypeDocRepo2D } from '../gg-2d-world';
import { Environment2dOpts } from '../models/environment';

/**
 * Applies scene environment settings (see `IVisualScene2dComponent.setEnvironment`) while it is in
 * the world, and restores whatever those fields were before once it is removed. This is what the 2D
 * `"Environment"` level-JSON class creates, so a level's background goes away when the level is
 * unloaded.
 *
 * Several of these can be in one world at once (e.g. two levels loaded during a transition) and be
 * removed in any order: each field shows the most recently spawned entity that sets it, and falls
 * back to the value from before any of them once none is left.
 * @template VTypeDoc - The visual type document repository
 */
export class Environment2dEntity<VTypeDoc extends VisualTypeDocRepo2D = VisualTypeDocRepo2D> extends IEntity<
  Point2,
  number,
  Gg2dWorldTypeDocVPatch<VTypeDoc>
> {
  static readonly entityTypeName: string = 'Environment2dEntity';
  public readonly tickOrder = TickOrder.OBJECTS_BINDING;

  private appliedTo: NonNullable<Gg2dWorld<Gg2dWorldTypeDocVPatch<VTypeDoc>>['visualScene']> | null = null;

  constructor(public readonly environment: Partial<Environment2dOpts<VTypeDoc['texture']>>) {
    super();
  }

  onSpawned(world: Gg2dWorld<Gg2dWorldTypeDocVPatch<VTypeDoc>>) {
    super.onSpawned(world);
    const scene = world.visualScene;
    if (!scene) {
      return;
    }
    this.appliedTo = scene;
    applyEnvironmentOverride(scene, this, this.environment);
  }

  onRemoved() {
    if (this.appliedTo) {
      removeEnvironmentOverride(this.appliedTo, this);
      this.appliedTo = null;
    }
    super.onRemoved();
  }
}
