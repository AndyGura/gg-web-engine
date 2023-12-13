import { AmmoRigidBodyComponent } from './components/ammo-rigid-body.component';
import { AmmoTriggerComponent } from './components/ammo-trigger.component';
import { AmmoRaycastVehicleComponent } from './components/ammo-raycast-vehicle.component';
import { AmmoFactory } from './ammo-factory';
import { AmmoLoader } from './ammo-loader';

export type AmmoPhysicsTypeDocRepo = {
  factory: AmmoFactory;
  loader: AmmoLoader;
  rigidBody: AmmoRigidBodyComponent;
  trigger: AmmoTriggerComponent;
  raycastVehicle: AmmoRaycastVehicleComponent;
};
