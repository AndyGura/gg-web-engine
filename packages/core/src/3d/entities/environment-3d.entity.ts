import { IEntity, Point3, Point4, TickOrder } from '../../base';
import { applyEnvironmentOverride, removeEnvironmentOverride } from '../../base/environment-overrides';
import { Gg3dWorld, Gg3dWorldTypeDocVPatch, VisualTypeDocRepo3D } from '../gg-3d-world';
import { Environment3dOpts } from '../models/environment';
import { findSceneOwner, resolveVisualScene } from '../interfaces/i-scene-owner';
import { assertNoBackdropBackground } from './backdrop-3d.entity';

/**
 * Applies scene environment settings (background, environment map, fog - see
 * `IVisualScene3dComponent.setEnvironment`) while it is in the world, and restores whatever those
 * fields were before once it is removed. This is what the `"Environment"` level-JSON class
 * creates, so a level's sky and fog go away when the level is unloaded. Apps that never swap
 * levels can call `world.visualScene.setEnvironment(...)` directly instead.
 *
 * Several of these can be in one world at once (e.g. two levels loaded during a transition) and be
 * removed in any order: each field shows the most recently spawned entity that sets it, and falls
 * back to the value from before any of them once none is left.
 *
 * As a descendant of a `Backdrop3dEntity` (any `ISceneOwner`) it applies to that backdrop's scene
 * instead: fog and environment map in backdrop units. A backdrop has no background of its own, so
 * spawning one there with a `background` throws.
 * @template VTypeDoc - The visual type document repository
 */
export class Environment3dEntity<VTypeDoc extends VisualTypeDocRepo3D = VisualTypeDocRepo3D> extends IEntity<
  Point3,
  Point4,
  Gg3dWorldTypeDocVPatch<VTypeDoc>
> {
  static readonly entityTypeName: string = 'Environment3dEntity';
  public readonly tickOrder = TickOrder.OBJECTS_BINDING;

  private appliedTo: NonNullable<Gg3dWorld<Gg3dWorldTypeDocVPatch<VTypeDoc>>['visualScene']> | null = null;

  /**
   * @param environment - The fields to apply while spawned
   * @param onDispose - Called once when the entity is disposed, after its settings are off the
   * scene - the place to free textures created only for this entity
   */
  constructor(
    public readonly environment: Partial<Environment3dOpts<VTypeDoc['texture']>>,
    private readonly onDispose?: () => void,
  ) {
    super();
  }

  onSpawned(world: Gg3dWorld<Gg3dWorldTypeDocVPatch<VTypeDoc>>) {
    if (findSceneOwner(this)) {
      assertNoBackdropBackground(this.environment, `Environment3dEntity "${this.name}" in a backdrop`);
    }
    super.onSpawned(world);
    const scene = resolveVisualScene(this, world);
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

  dispose(): void {
    if (this.disposed) {
      return;
    }
    super.dispose();
    this.onDispose?.();
  }
}
