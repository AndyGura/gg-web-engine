import { IEntity } from '../entities/i-entity';
import { GgWorld, GgWorldTypeDocRepo } from '../gg-world';
import { IComponent } from './i-component';

export interface IWorldComponent<
  D,
  R,
  TypeDoc extends GgWorldTypeDocRepo<D, R> = GgWorldTypeDocRepo<D, R>,
> extends IComponent {
  entity: IEntity | null;

  addToWorld(world: GgWorld<D, R, TypeDoc>): void;

  /**
   * Detaches this component from `world`. `dispose` (default `false`) is the caller's declaration
   * of intent, not merely a logging hint: when `true`, the implementation MUST additionally free
   * any native/backend resource this component owns (physics shape/body handle, GPU buffer, ghost
   * object, ...) as part of this same call - not just stop tracking the component in `world`. A
   * caller passing `dispose: true` (e.g. `IEntity.removeComponents(components, true)`, used by
   * `CharacterController3dEntity.recreateCapsule` when swapping in a replacement component and
   * dropping its only reference to the old one right after) relies on that to avoid leaking the
   * native resource, since nothing else will ever call `dispose()` on the discarded component
   * afterwards - `IEntity.onRemoved` itself always passes `false` (an entity being removed from the
   * world is not necessarily being destroyed), so `dispose()`/`true` only ever comes from an
   * explicit caller decision. Every concrete component overriding `removeFromWorld` must honor
   * `dispose` for this contract to hold - see `gg-engine-physics-adapter`'s "The
   * `removeFromWorld(dispose)` contract" section for a confirmed instance (Ammo's character
   * controller) where an override silently ignores the flag and leaks.
   */
  removeFromWorld(world: GgWorld<D, R, TypeDoc>, dispose?: boolean): void;
}
