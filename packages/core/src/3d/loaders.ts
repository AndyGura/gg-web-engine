import { GgMeta } from './models/gg-meta';
import { IRigidBody3dComponent } from './components/physics/i-rigid-body-3d.component';
import { IDisplayObject3dComponent } from './components/rendering/i-display-object-3d.component';
import { IPhysicsWorld3dComponent } from './components/physics/i-physics-world-3d.component';

export abstract class IPhysicsBody3dComponentLoader {
  protected constructor(protected readonly world: IPhysicsWorld3dComponent) {
  }

  async loadFromGgGlb(glbFile: ArrayBuffer, meta: GgMeta): Promise<IRigidBody3dComponent[]> {
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

export interface IDisplayObject3dComponentLoader {
  loadFromGgGlb(glbFile: ArrayBuffer, meta: GgMeta): Promise<IDisplayObject3dComponent | null>;
}
