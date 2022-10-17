import { GgWorld } from '../gg-world';
import { GgEntity } from './gg-entity';
import { ITickListener } from './interfaces/i-tick-listener';
import { Subject, Subscription } from 'rxjs';

export class InlineTickController extends GgEntity implements ITickListener {
  readonly tick$: Subject<[number, number]> = new Subject<[number, number]>();
  protected tickSub: Subscription;

  constructor(handler: (elapsed: number, delta: number) => void) {
    super();
    this.tickSub = this.tick$.subscribe((value) => { handler(...value); });
  }

  dispose(): void {
    this.tickSub.unsubscribe();
  }

}

export function createInlineController(world: GgWorld<any, any>, tickCallback: (elapsed: number, delta: number) => void): () => void {
  const controller: InlineTickController = new InlineTickController(tickCallback);
  world.addEntity(controller);
  return () => {
    world.removeEntity(controller);
    controller.dispose();
  }
}
