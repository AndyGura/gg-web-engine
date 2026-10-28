import { ITriggerComponent, Point3, Point4 } from '../../../base';
import { Observable } from 'rxjs';
import { PhysicsTypeDocRepo3D } from '../../gg-3d-world';
import { DebugBody3DSettings } from '../../models/body-options';
import { Frame3d } from '../../models/frame-3d';

export interface ITrigger3dComponent<
  PTypeDoc extends PhysicsTypeDocRepo3D = PhysicsTypeDocRepo3D,
> extends ITriggerComponent<Point3, Point4, PTypeDoc> {
  /** body info for physics debugger view */
  readonly debugBodySettings: DebugBody3DSettings;

  get onEntityEntered(): Observable<PTypeDoc['rigidBody'] | PTypeDoc['characterController']>;

  get onEntityLeft(): Observable<PTypeDoc['rigidBody'] | PTypeDoc['characterController'] | null>;

  /**
   * Optional. Moves the trigger by `delta` for a frame switch (see `IRigidBody3dComponent
   * .onFrameSwitch`), keeping its current overlaps: everything inside moves along, so the switch
   * itself never makes the trigger report a leave or an enter. Without it, core falls back to the
   * `position`/`rotation` setters.
   */
  onFrameSwitch?(delta: Frame3d): void;
}
