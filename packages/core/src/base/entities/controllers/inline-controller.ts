import { GgWorld } from '../../gg-world';
import { IEntity, TickOrder } from '../i-entity';
import { finalize, Observable } from 'rxjs';

class InlineTickController extends IEntity {
  constructor(public readonly tickOrder: TickOrder | number) {
    super();
  }
}

export function createInlineTickController(
  world: GgWorld<any, any>,
  tickOrder: number = TickOrder.CONTROLLERS,
  name?: string,
): Observable<[number, number]> {
  const controller: InlineTickController = new InlineTickController(tickOrder);
  if (name) {
    controller.name = name;
  }
  world.addEntity(controller);
  return controller.tick$.pipe(
    finalize(() => {
      world.removeEntity(controller, true);
    }),
  );
}
