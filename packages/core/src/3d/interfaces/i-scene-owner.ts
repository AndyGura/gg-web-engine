import { IEntity } from '../../base/entities/i-entity';
import type { VisualTypeDocRepo3D } from '../gg-3d-world';
import type { IVisualScene3dComponent } from '../components/rendering/i-visual-scene-3d.component';

/**
 * An entity whose subtree draws into a visual scene of its own, `ownedScene`, instead of the
 * world's `visualScene`, and lives in that scene's own coordinate space. Two rules follow, both
 * applied by the engine without the descendants knowing:
 *
 * - every visual component (display object, light, particle system) and every `Environment3dEntity`
 *   below it attaches to `ownedScene` - see {@link resolveVisualScene};
 * - `Gg3dWorld.switchFrame` leaves the subtree alone: its positions are not the world's local
 *   coordinates, so moving them with the world would be wrong.
 *
 * `Backdrop3dEntity` is the one implementation today. Opt-in: an entity that does not implement
 * it draws into whatever its nearest owning ancestor's scene is, else the world's.
 * @template VTypeDoc - The visual type document repository
 */
export interface ISceneOwner<VTypeDoc extends VisualTypeDocRepo3D = VisualTypeDocRepo3D> {
  /** The scene this entity's descendants draw into. */
  readonly ownedScene: IVisualScene3dComponent<VTypeDoc>;
}

/** Whether `e` implements {@link ISceneOwner}. */
export function isSceneOwner(e: unknown): e is ISceneOwner {
  return !!e && typeof e === 'object' && !!(e as ISceneOwner).ownedScene;
}

/**
 * The nearest proper ancestor of `entity` implementing {@link ISceneOwner}, or `null` when none of
 * its ancestors does (the entity draws into the world's scene and lives in its local space).
 */
export function findSceneOwner(entity: IEntity | null): ISceneOwner | null {
  for (let e = entity?.parent ?? null; e; e = e.parent) {
    if (isSceneOwner(e)) {
      return e;
    }
  }
  return null;
}

/**
 * The visual scene `entity`'s visual components attach to: the `ownedScene` of its nearest
 * {@link ISceneOwner} ancestor, else `world.visualScene`. A visual adapter's components call it in
 * `addToWorld`/`removeFromWorld` instead of reading `world.visualScene`, so content placed under a
 * backdrop lands in the backdrop's scene. `S` is the adapter's own scene class: an owned scene is
 * created by `world.visualScene.createBackdropScene()`, i.e. by the same adapter.
 * @param entity - The component's entity (`component.entity`); `null` resolves to the world's scene
 * @param world - The world the component is being added to or removed from
 */
export function resolveVisualScene<S>(entity: IEntity | null, world: { readonly visualScene: S }): S {
  const owner = findSceneOwner(entity);
  return owner ? (owner.ownedScene as unknown as S) : world.visualScene;
}
