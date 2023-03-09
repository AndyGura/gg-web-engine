import { IGg2dTrigger } from '../interfaces';
import { Gg2dEntity } from './gg-2d-entity';
import { Observable } from 'rxjs';
import { GgPositionable2dEntity } from './gg-positionable-2d-entity';

export class Gg2dTriggerEntity extends Gg2dEntity {
  get onEntityEntered(): Observable<GgPositionable2dEntity> {
    return this.objectBody.onEntityEntered;
  }

  constructor(
    public readonly objectBody: IGg2dTrigger,
  ) {
    super(null, objectBody);
  }
}
