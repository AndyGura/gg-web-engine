import { IRenderableEntity, Point3, Point4 } from '../../base';
import { IVisualScene3dComponent } from '../components/rendering/i-visual-scene-3d.component';
import { IPhysicsWorld3dComponent } from '../components/physics/i-physics-world-3d';

export abstract class IRenderable3dEntity<
  VS extends IVisualScene3dComponent = IVisualScene3dComponent,
  PW extends IPhysicsWorld3dComponent = IPhysicsWorld3dComponent,
> extends IRenderableEntity<Point3, Point4, VS, PW> {}
