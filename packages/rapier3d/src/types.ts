import { Rapier3dFactory } from './rapier-3d-factory';
import { Rapier3dLoader } from './rapier-3d-loader';
import { Rapier3dRigidBodyComponent } from './components/rapier-3d-rigid-body.component';
import { Rapier3dTriggerComponent } from './components/rapier-3d-trigger.component';
import { Gg3dWorld, Gg3dWorldSceneTypeDocPPatch, Gg3dWorldTypeDocPPatch } from '@gg-web-engine/core';
import { Rapier3dWorldComponent } from './components/rapier-3d-world.component';

export type Rapier3dPhysicsTypeDocRepo = {
  factory: Rapier3dFactory;
  loader: Rapier3dLoader;
  rigidBody: Rapier3dRigidBodyComponent;
  trigger: Rapier3dTriggerComponent;
  raycastVehicle: never; //Rapier3dRaycastVehicleComponent;
};

export type Rapier3dGgWorld = Gg3dWorld<
  Gg3dWorldTypeDocPPatch<Rapier3dPhysicsTypeDocRepo>,
  Gg3dWorldSceneTypeDocPPatch<Rapier3dPhysicsTypeDocRepo, Rapier3dWorldComponent>
>;
