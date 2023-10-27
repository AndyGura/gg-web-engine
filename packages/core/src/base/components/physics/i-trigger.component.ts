import { Observable } from 'rxjs';
import { IRigidBodyComponent } from './i-rigid-body.component';
import { IPhysicsWorldComponent } from './i-physics-world.component';

export interface ITriggerComponent<D, R, PW extends IPhysicsWorldComponent<D, R> = IPhysicsWorldComponent<D, R>>
  extends IRigidBodyComponent<D, R, PW> {
  get onEntityEntered(): Observable<IRigidBodyComponent<D, R>>;

  get onEntityLeft(): Observable<IRigidBodyComponent<D, R> | null>;

  checkOverlaps(): void;
}
