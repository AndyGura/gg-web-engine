import { IEntity, Point2, TickOrder } from '../../base';
import { Gg2dWorld, Gg2dWorldTypeDocVPatch, VisualTypeDocRepo2D } from '../gg-2d-world';
import { Environment2dOpts } from '../models/environment';

/**
 * Applies scene environment settings (see `IVisualScene2dComponent.setEnvironment`) while it is in
 * the world, and restores whatever those fields were before once it is removed. This is what the 2D
 * `"Environment"` level-JSON class creates, so a level's background goes away when the level is
 * unloaded.
 * @template VTypeDoc - The visual type document repository
 */
export class Environment2dEntity<VTypeDoc extends VisualTypeDocRepo2D = VisualTypeDocRepo2D> extends IEntity<
  Point2,
  number,
  Gg2dWorldTypeDocVPatch<VTypeDoc>
> {
  static readonly entityTypeName: string = 'Environment2dEntity';
  public readonly tickOrder = TickOrder.OBJECTS_BINDING;

  private previous: Partial<Environment2dOpts<VTypeDoc['texture']>> | null = null;

  constructor(public readonly environment: Partial<Environment2dOpts<VTypeDoc['texture']>>) {
    super();
  }

  onSpawned(world: Gg2dWorld<Gg2dWorldTypeDocVPatch<VTypeDoc>>) {
    super.onSpawned(world);
    const scene = world.visualScene;
    if (!scene) {
      return;
    }
    const current = scene.environment;
    const previous: Partial<Environment2dOpts<VTypeDoc['texture']>> = {};
    for (const key of Object.keys(this.environment) as (keyof Environment2dOpts<VTypeDoc['texture']>)[]) {
      (previous as any)[key] = current[key];
    }
    this.previous = previous;
    scene.setEnvironment(this.environment);
  }

  onRemoved() {
    const scene = (this.world as Gg2dWorld<Gg2dWorldTypeDocVPatch<VTypeDoc>> | null)?.visualScene;
    if (scene && this.previous) {
      scene.setEnvironment(this.previous);
    }
    this.previous = null;
    super.onRemoved();
  }
}
