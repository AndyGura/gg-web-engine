import { Subject } from 'rxjs';
import { GgEntity } from '../gg-entity';

export interface ITickListener {

  // will receive [elapsed time, delta] of each world clock tick
  tick$: Subject<[number, number]>;
  // the priority of ticker: the less value, the earlier tick will be run.
  // 500 is a physics tick order
  // 750 is a default objects binding tick order
  // 1000 is a rendering tick order
  // e.g. 499 will run before physics, 1001 will run after rendering
  readonly tickOrder: number;

}

export const isITickListener: (entity: GgEntity) => boolean = (entity) => (entity as any)?.tick$ instanceof Subject;
