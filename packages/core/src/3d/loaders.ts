import { GgMeta, GgRigidBody } from './models/gg-meta';
import { IPhysicsWorld3dComponent } from './components/physics/i-physics-world-3d.component';
import { PhysicsTypeDocRepo3D, VisualTypeDocRepo3D } from './gg-3d-world';
import { Point3 } from '../base';

/**
 * `.meta` format 1 (or no `formatVersion` at all - see `GgMeta.formatVersion`'s own doc) wrote
 * `body.dynamic: boolean` instead of format 2's `body.bodyType`; migrate it in place so every
 * adapter's `createRigidBody` only ever has to understand the current shape. Mutates `d.body`
 * (cheap, and the caller doesn't need the pre-migration value for anything else) rather than
 * copying the whole descriptor. The `(d.body as any).dynamic !== undefined` check (on top of the
 * version check) is defensive, not load-bearing: a stray hand-edited or malformed `.meta` with a
 * mismatched `formatVersion` still migrates correctly, or the field is left untouched instead of
 * writing `bodyType: 'static'` in from `dynamic: undefined`.
 */
function migrateLegacyBodyType(d: GgRigidBody, formatVersion: number | undefined): void {
  if ((formatVersion ?? 1) >= 2) {
    return;
  }
  if (!d.body.bodyType && (d.body as any).dynamic !== undefined) {
    d.body.bodyType = (d.body as any).dynamic ? 'dynamic' : 'static';
  }
}

export abstract class IPhysicsBody3dComponentLoader<PTypeDoc extends PhysicsTypeDocRepo3D = PhysicsTypeDocRepo3D> {
  protected constructor(protected readonly world: IPhysicsWorld3dComponent) {}

  async loadFromGgGlb(glbFile: ArrayBuffer, meta: GgMeta): Promise<PTypeDoc['rigidBody'][]> {
    return (meta?.rigidBodies || []).map(d => {
      migrateLegacyBodyType(d, meta.formatVersion);
      const body = this.world.factory.createRigidBody(
        { shape: d.shape, body: d.body },
        { position: d.position, rotation: d.rotation },
      );
      body.name = d.name;
      return body;
    });
  }
}

/**
 * Options for {@link IDisplayObject3dComponentLoader.loadFromGlb}.
 */
export interface LoadGlbOptions {
  /**
   * Local offset applied to the loaded model, independent of whatever world position/rotation the
   * returned display object is subsequently moved to (e.g. by `Entity3d`/`CharacterController3dEntity`
   * syncing it from a driving body every tick, which otherwise overwrites the object's position
   * outright rather than composing with it). Mainly for a model authored with its origin somewhere
   * other than the point that should track the entity's own position - e.g. a character rig
   * authored with its origin at the feet, offset to align with a `CharacterController3dEntity`
   * capsule's center. Left unset, the loaded model's own authored origin is used as-is.
   */
  offset?: Point3;
}

export interface IDisplayObject3dComponentLoader<VTypeDoc extends VisualTypeDocRepo3D = VisualTypeDocRepo3D> {
  loadFromGgGlb(glbFile: ArrayBuffer, meta: GgMeta): Promise<VTypeDoc['displayObject'] | null>;

  /**
   * Loads a plain `.glb` file - no paired `.meta` (see `loadFromGgGlb`), no physics bodies, just
   * the visual mesh - and its animation clips, if it has any. Returns a display object
   * implementing {@link IAnimatedDisplayObject3dComponent} (checkable via
   * `isAnimatedDisplayObject3d`) when the file's own animations are non-empty, otherwise an
   * ordinary one, same as any other loaded model. The generic entry point for any visual-only
   * asset (a character model, a prop with no physics representation of its own, ...) that doesn't
   * need the GG meta/physics-body pipeline `loadFromGgGlb` provides.
   */
  loadFromGlb(glbFile: ArrayBuffer, options?: LoadGlbOptions): Promise<VTypeDoc['displayObject'] | null>;
}
