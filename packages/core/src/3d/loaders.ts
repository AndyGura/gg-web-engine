import { GgMeta, GgRigidBody } from './models/gg-meta';
import { IPhysicsWorld3dComponent } from './components/physics/i-physics-world-3d.component';
import { PhysicsTypeDocRepo3D, VisualTypeDocRepo3D } from './gg-3d-world';

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

export interface IDisplayObject3dComponentLoader<VTypeDoc extends VisualTypeDocRepo3D = VisualTypeDocRepo3D> {
  loadFromGgGlb(glbFile: ArrayBuffer, meta: GgMeta): Promise<VTypeDoc['displayObject'] | null>;
}
