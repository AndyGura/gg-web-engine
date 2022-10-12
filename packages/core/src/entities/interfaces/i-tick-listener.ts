import { Subject } from 'rxjs';
import { GgEntity } from '../gg-entity';

export interface ITickListener {

  // will receive delta of each world clock tick
  tick$: Subject<number>;

}

export const isITickListener: (entity: GgEntity) => boolean = (entity) => (entity as any)?.tick$ instanceof Subject;
