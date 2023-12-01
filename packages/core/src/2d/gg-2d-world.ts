import { GgWorld, Pnt2, Point2, RendererOptions } from '../base';
import { BodyShape2DDescriptor } from './models/shapes';
import { Entity2d } from './entities/entity-2d';
import { IPhysicsWorld2dComponent } from './components/physics/i-physics-world-2d.component';
import { IVisualScene2dComponent } from './components/rendering/i-visual-scene-2d.component';
import { Renderer2dEntity } from './entities/renderer-2d.entity';

export class Gg2dWorld<
  V extends IVisualScene2dComponent = IVisualScene2dComponent,
  P extends IPhysicsWorld2dComponent = IPhysicsWorld2dComponent,
> extends GgWorld<Point2, number, V, P> {
  constructor(public readonly visualScene: V, public readonly physicsWorld: P) {
    super(visualScene, physicsWorld);
    if ((window as any).ggstatic) {
      (window as any).ggstatic.registerConsoleCommand(
        this,
        'ph_gravity',
        async (...args: string[]) => {
          if (args.length == 1) {
            args = ['0', args[0]]; // mean Y axis
          }
          if (args.length > 0) {
            this.physicsWorld.gravity = { x: +args[0], y: +args[1] };
          }
          return JSON.stringify(this.physicsWorld.gravity);
        },
        'args: [float] or [float float]; change 2D world gravity vector. 1 argument means ' +
          '{x: 0, y: value}, 2 arguments set the whole vector. Default value is "9.82" or "0 9.82"',
      );
    }
  }

  addPrimitiveRigidBody(descr: BodyShape2DDescriptor, position: Point2 = Pnt2.O, rotation: number = 0): Entity2d<V, P> {
    const entity = new Entity2d<V, P>(
      this.visualScene.factory.createPrimitive(descr.shape),
      this.physicsWorld.factory.createRigidBody(descr),
    );
    entity.position = position;
    entity.rotation = rotation;
    this.addEntity(entity);
    return entity;
  }

  addRenderer(canvas?: HTMLCanvasElement, rendererOptions?: Partial<RendererOptions>): Renderer2dEntity {
    const entity = new Renderer2dEntity(this.visualScene.createRenderer(canvas, rendererOptions));
    this.addEntity(entity);
    return entity;
  }
}
