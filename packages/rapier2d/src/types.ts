import { Rapier2dFactory } from './rapier-2d-factory';
import { Rapier2dRigidBodyComponent } from './components/rapier-2d-rigid-body.component';
import { Rapier2dTriggerComponent } from './components/rapier-2d-trigger.component';

export type Rapier2dPhysicsTypeDocRepo = {
  factory: Rapier2dFactory;
  rigidBody: Rapier2dRigidBodyComponent;
  trigger: Rapier2dTriggerComponent;
};
