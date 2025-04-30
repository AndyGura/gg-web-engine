import { Observable } from 'rxjs';
import { IRigidBodyComponent } from './i-rigid-body.component';
import { IBodyComponent } from './i-body.component';
import { PhysicsTypeDocRepo } from '../../gg-world';

export interface ITriggerComponent<D, R, PTypeDoc extends PhysicsTypeDocRepo<D, R> = PhysicsTypeDocRepo<D, R>>
  extends IBodyComponent<D, R, PTypeDoc> {
  get onEntityEntered(): Observable<IRigidBodyComponent<D, R, PTypeDoc>>;

  get onEntityLeft(): Observable<IRigidBodyComponent<D, R, PTypeDoc> | null>;

  clone(): ITriggerComponent<D, R, PTypeDoc>;

  checkOverlaps(): void;
}
