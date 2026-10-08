import { Observable } from 'rxjs';
import { IBodyComponent } from './i-body.component';
import { PhysicsTypeDocRepo } from '../../gg-world';

export interface ITriggerComponent<
  D,
  R,
  PTypeDoc extends PhysicsTypeDocRepo<D, R> = PhysicsTypeDocRepo<D, R>,
> extends IBodyComponent<D, R, PTypeDoc> {
  get onEntityEntered(): Observable<IBodyComponent<D, R, PTypeDoc>>;

  /**
   * Fires when a body stops overlapping this trigger. That includes a body removed from the world
   * (or removed and disposed) while still inside: every adapter emits that body's component, so an
   * enter/leave count stays balanced. When its whole entity was removed, `entity.world` is already
   * `null` by the time this fires, which is how a handler tells "left the area" from "was removed".
   * `null` means the adapter could not tell which body it was.
   */
  get onEntityLeft(): Observable<IBodyComponent<D, R, PTypeDoc> | null>;

  clone(): ITriggerComponent<D, R, PTypeDoc>;

  checkOverlaps(): void;
}
