import { AmmoRigidBodyComponent } from './components/ammo-rigid-body.component';
import { AmmoTriggerComponent } from './components/ammo-trigger.component';
import { AmmoRaycastVehicleComponent } from './components/ammo-raycast-vehicle.component';
import { AmmoFactory } from './ammo-factory';
import { AmmoLoader } from './ammo-loader';
import { Gg3dWorld, Gg3dWorldSceneTypeDocPPatch, Gg3dWorldTypeDocPPatch } from '@gg-web-engine/core';
import { AmmoWorldComponent } from './components/ammo-world.component';

export type AmmoPhysicsTypeDocRepo = {
  factory: AmmoFactory;
  loader: AmmoLoader;
  rigidBody: AmmoRigidBodyComponent;
  trigger: AmmoTriggerComponent;
  raycastVehicle: AmmoRaycastVehicleComponent;
};

export type AmmoTypeDoc = Gg3dWorldTypeDocPPatch<AmmoPhysicsTypeDocRepo>;
export type AmmoSceneTypeDoc = Gg3dWorldSceneTypeDocPPatch<AmmoPhysicsTypeDocRepo, AmmoWorldComponent>;

export type AmmoGgWorld = Gg3dWorld<AmmoTypeDoc, AmmoSceneTypeDoc>;
