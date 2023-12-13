import { Observable } from 'rxjs';
import { IRigidBodyComponent } from './i-rigid-body.component';
import { IBodyComponent } from './i-body.component';
import { PhysicsTypeDocRepo } from '../../gg-world';

export interface ITriggerComponent<D, R, TypDoc extends PhysicsTypeDocRepo<D, R> = PhysicsTypeDocRepo<D, R>>
  extends IBodyComponent<D, R, TypDoc> {
  get onEntityEntered(): Observable<IRigidBodyComponent<D, R, TypDoc>>;

  get onEntityLeft(): Observable<IRigidBodyComponent<D, R, TypDoc> | null>;

  clone(): ITriggerComponent<D, R, TypDoc>;

  checkOverlaps(): void;
}
