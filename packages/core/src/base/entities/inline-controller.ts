import { GgWorld } from '../gg-world';
import { GgEntity } from './gg-entity';
import { ITickListener } from './interfaces/i-tick-listener';
import { finalize, Observable, Subject } from 'rxjs';

class InlineTickController extends GgEntity implements ITickListener {
  public readonly tick$: Subject<[number, number]> = new Subject<[number, number]>();

  constructor(
    public readonly tickOrder: number,
  ) {
    super();
  }

  dispose(): void {
  }
}

export function createInlineTickController(world: GgWorld<any, any>, tickOrder: number = 750): Observable<[number, number]> {
  const controller: InlineTickController = new InlineTickController(tickOrder);
  world.addEntity(controller);
  return controller.tick$.pipe(
    finalize(() => {
      world.removeEntity(controller);
    })
  );
}
