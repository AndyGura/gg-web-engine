import { Observable } from 'rxjs';
import { IRigidBodyComponent } from './i-rigid-body.component';
import { IPhysicsWorldComponent } from './i-physics-world.component';
import { IBodyComponent } from './i-body.component';

export interface ITriggerComponent<D, R, PW extends IPhysicsWorldComponent<D, R> = IPhysicsWorldComponent<D, R>>
  extends IBodyComponent<D, R, PW> {
  get onEntityEntered(): Observable<IRigidBodyComponent<D, R>>;

  get onEntityLeft(): Observable<IRigidBodyComponent<D, R> | null>;

  clone(): ITriggerComponent<D, R, PW>;

  checkOverlaps(): void;
}
