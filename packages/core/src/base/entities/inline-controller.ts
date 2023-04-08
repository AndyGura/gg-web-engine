import { GgWorld } from '../gg-world';
import { GgEntity, GGTickOrder } from './gg-entity';
import { finalize, Observable } from 'rxjs';

class InlineTickController extends GgEntity {
  constructor(public readonly tickOrder: GGTickOrder | number) {
    super();
  }
}

export function createInlineTickController(
  world: GgWorld<any, any>,
  tickOrder: number = GGTickOrder.CONTROLLERS,
): Observable<[number, number]> {
  const controller: InlineTickController = new InlineTickController(tickOrder);
  world.addEntity(controller);
  return controller.tick$.pipe(
    finalize(() => {
      world.removeEntity(controller);
    }),
  );
}
