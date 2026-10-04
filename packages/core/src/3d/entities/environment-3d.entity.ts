import { IEntity, Point3, Point4, TickOrder } from '../../base';
import { Gg3dWorld, Gg3dWorldTypeDocVPatch, VisualTypeDocRepo3D } from '../gg-3d-world';
import { Environment3dOpts } from '../models/environment';

/**
 * Applies scene environment settings (background, environment map, fog - see
 * `IVisualScene3dComponent.setEnvironment`) while it is in the world, and restores whatever those
 * fields were before once it is removed. This is what the `"Environment"` level-JSON class
 * creates, so a level's sky and fog go away when the level is unloaded. Apps that never swap
 * levels can call `world.visualScene.setEnvironment(...)` directly instead.
 * @template VTypeDoc - The visual type document repository
 */
export class Environment3dEntity<VTypeDoc extends VisualTypeDocRepo3D = VisualTypeDocRepo3D> extends IEntity<
  Point3,
  Point4,
  Gg3dWorldTypeDocVPatch<VTypeDoc>
> {
  static readonly entityTypeName: string = 'Environment3dEntity';
  public readonly tickOrder = TickOrder.OBJECTS_BINDING;

  private previous: Partial<Environment3dOpts<VTypeDoc['texture']>> | null = null;

  constructor(public readonly environment: Partial<Environment3dOpts<VTypeDoc['texture']>>) {
    super();
  }

  onSpawned(world: Gg3dWorld<Gg3dWorldTypeDocVPatch<VTypeDoc>>) {
    super.onSpawned(world);
    const scene = world.visualScene;
    if (!scene) {
      return;
    }
    const current = scene.environment;
    const previous: Partial<Environment3dOpts<VTypeDoc['texture']>> = {};
    for (const key of Object.keys(this.environment) as (keyof Environment3dOpts<VTypeDoc['texture']>)[]) {
      (previous as any)[key] = current[key];
    }
    this.previous = previous;
    scene.setEnvironment(this.environment);
  }

  onRemoved() {
    const scene = (this.world as Gg3dWorld<Gg3dWorldTypeDocVPatch<VTypeDoc>> | null)?.visualScene;
    if (scene && this.previous) {
      scene.setEnvironment(this.previous);
    }
    this.previous = null;
    super.onRemoved();
  }
}
