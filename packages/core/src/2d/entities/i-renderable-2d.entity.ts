import { IRenderableEntity, Point2 } from '../../base';
import { IVisualScene2dComponent } from '../components/rendering/i-visual-scene-2d.component';
import { IPhysicsWorld2dComponent } from '../components/physics/i-physics-world-2d.component';

export abstract class IRenderable2dEntity<
  VS extends IVisualScene2dComponent = IVisualScene2dComponent,
  PW extends IPhysicsWorld2dComponent = IPhysicsWorld2dComponent,
> extends IRenderableEntity<Point2, number, VS, PW> {}
