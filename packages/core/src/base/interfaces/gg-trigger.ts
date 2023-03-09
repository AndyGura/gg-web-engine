import { GgBody } from './gg-body';
import { GgPositionableEntity } from '../entities/gg-positionable-entity';
import { Observable } from 'rxjs';

export interface GgTrigger<D, R> extends GgBody<D, R> {
  get onEntityEntered(): Observable<GgPositionableEntity<D, R>>;
}
