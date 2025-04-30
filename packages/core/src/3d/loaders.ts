import { GgMeta } from './models/gg-meta';
import { IPhysicsWorld3dComponent } from './components/physics/i-physics-world-3d.component';
import { PhysicsTypeDocRepo3D, VisualTypeDocRepo3D } from './gg-3d-world';

export abstract class IPhysicsBody3dComponentLoader<PTypeDoc extends PhysicsTypeDocRepo3D = PhysicsTypeDocRepo3D> {
  protected constructor(protected readonly world: IPhysicsWorld3dComponent) {}

  async loadFromGgGlb(glbFile: ArrayBuffer, meta: GgMeta): Promise<PTypeDoc['rigidBody'][]> {
    return (meta?.rigidBodies || []).map(d => {
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
