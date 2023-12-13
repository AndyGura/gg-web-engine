import { Rapier3dFactory } from './rapier-3d-factory';
import { Rapier3dLoader } from './rapier-3d-loader';
import { Rapier3dRigidBodyComponent } from './components/rapier-3d-rigid-body.component';
import { Rapier3dTriggerComponent } from './components/rapier-3d-trigger.component';

export type Rapier3dPhysicsTypeDocRepo = {
  factory: Rapier3dFactory;
  loader: Rapier3dLoader;
  rigidBody: Rapier3dRigidBodyComponent;
  trigger: Rapier3dTriggerComponent;
  raycastVehicle: never; //Rapier3dRaycastVehicleComponent;
};
