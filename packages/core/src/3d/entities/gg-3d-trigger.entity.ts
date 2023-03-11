import { IGg3dTrigger } from '../interfaces';
import { Gg3dEntity } from './gg-3d-entity';
import { Observable } from 'rxjs';
import { GgPositionable3dEntity } from './gg-positionable-3d-entity';

export class Gg3dTriggerEntity extends Gg3dEntity {
  get onEntityEntered(): Observable<GgPositionable3dEntity> {
    return this.objectBody.onEntityEntered;
  }

  get onEntityLeft(): Observable<GgPositionable3dEntity | null> {
    return this.objectBody.onEntityLeft;
  }

  constructor(
    public readonly objectBody: IGg3dTrigger,
  ) {
    super(null, objectBody);
    this.tick$.subscribe(() => {
      this.objectBody.checkOverlaps();
    });
    this.objectBody.entity = this;
  }
}
